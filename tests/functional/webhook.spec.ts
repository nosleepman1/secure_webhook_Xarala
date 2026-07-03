import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Order from '#models/order'
import PaymentEvent from '#models/payment_event'
import PaymentSignatureService from '#services/payment_signature_service'

test.group('Webhook paiement', (group) => {
  // Chaque test tourne dans une transaction DB annulée à la fin :
  // pas besoin de nettoyer manuellement, la base reste propre entre tests.
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un paiement valide marque la commande payée', async ({ client, assert }) => {
    const order = await Order.create({
      orderId: 'ORD-SPEC-001',
      amount: 15000,
      status: 'pending',
    })

    const signature = PaymentSignatureService.computeSignature({
      transactionId: 'TX-SPEC-001',
      orderId: order.orderId,
      amount: 15000,
      timestamp: 1751000000,
    })

    const response = await client.post('/webhooks/payment').json({
      transaction_id: 'TX-SPEC-001',
      order_id: order.orderId,
      status: 'success',
      amount: 15000,
      signature,
      timestamp: 1751000000,
    })

    response.assertStatus(200)
    response.assertBodyContains({ status: 'processed' })

    await order.refresh()
    assert.equal(order.status, 'paid')
  })

  test('rejouer le même webhook ne traite qu une seule fois (idempotence)', async ({
    client,
    assert,
  }) => {
    const order = await Order.create({
      orderId: 'ORD-SPEC-002',
      amount: 20000,
      status: 'pending',
    })

    const payload = {
      transaction_id: 'TX-SPEC-002',
      order_id: order.orderId,
      status: 'success' as const,
      amount: 20000,
      timestamp: 1751000000,
    }

    const signature = PaymentSignatureService.computeSignature({
      transactionId: payload.transaction_id,
      orderId: payload.order_id,
      amount: payload.amount,
      timestamp: payload.timestamp,
    })

    // Premier envoi
    const first = await client.post('/webhooks/payment').json({ ...payload, signature })
    first.assertStatus(200)
    first.assertBodyContains({ status: 'processed' })

    // Replay exact du même webhook
    const second = await client.post('/webhooks/payment').json({ ...payload, signature })
    second.assertStatus(200)
    second.assertBodyContains({ status: 'already_processed' })

    // Un seul PaymentEvent doit exister pour ce transaction_id
    const events = await PaymentEvent.query().where('transaction_id', payload.transaction_id)
    assert.lengthOf(events, 1)
  })

  test('une signature invalide est rejetée avec 401', async ({ client, assert }) => {
    const order = await Order.create({
      orderId: 'ORD-SPEC-003',
      amount: 10000,
      status: 'pending',
    })

    const response = await client.post('/webhooks/payment').json({
      transaction_id: 'TX-SPEC-003',
      order_id: order.orderId,
      status: 'success',
      amount: 10000,
      signature: 'signature_totalement_invalide_0000000000000000000000000000000',
      timestamp: 1751000000,
    })

    response.assertStatus(401)
    response.assertBodyContains({ error: 'invalid_signature' })

    // La commande ne doit pas avoir bougé
    await order.refresh()
    assert.equal(order.status, 'pending')

    // Aucun PaymentEvent ne doit avoir été créé
    const events = await PaymentEvent.query().where('transaction_id', 'TX-SPEC-003')
    assert.lengthOf(events, 0)
  })

  test('un montant incohérent est tracé sans valider la commande', async ({
    client,
    assert,
  }) => {
    const order = await Order.create({
      orderId: 'ORD-SPEC-004',
      amount: 15000,
      status: 'pending',
    })

    const receivedAmount = 9999 // différent des 15000 attendus

    const signature = PaymentSignatureService.computeSignature({
      transactionId: 'TX-SPEC-004',
      orderId: order.orderId,
      amount: receivedAmount,
      timestamp: 1751000000,
    })

    const response = await client.post('/webhooks/payment').json({
      transaction_id: 'TX-SPEC-004',
      order_id: order.orderId,
      status: 'success',
      amount: receivedAmount,
      signature,
      timestamp: 1751000000,
    })

    response.assertStatus(200)
    response.assertBodyContains({ status: 'amount_mismatch_logged' })

    // La commande ne doit PAS être marquée payée sur un montant incohérent
    await order.refresh()
    assert.notEqual(order.status, 'paid')

    // L'anomalie doit être tracée en base
    const event = await PaymentEvent.findByOrFail('transaction_id', 'TX-SPEC-004')
    assert.isTrue(event.amountMismatch)
  })

  test('une commande introuvable est ignorée proprement', async ({ client, assert }) => {
    const signature = PaymentSignatureService.computeSignature({
      transactionId: 'TX-SPEC-005',
      orderId: 'ORD-INEXISTANTE',
      amount: 5000,
      timestamp: 1751000000,
    })

    const response = await client.post('/webhooks/payment').json({
      transaction_id: 'TX-SPEC-005',
      order_id: 'ORD-INEXISTANTE',
      status: 'success',
      amount: 5000,
      signature,
      timestamp: 1751000000,
    })

    response.assertStatus(200)
    response.assertBodyContains({ status: 'ignored' })

    const events = await PaymentEvent.query().where('transaction_id', 'TX-SPEC-005')
    assert.lengthOf(events, 0)
  })
})
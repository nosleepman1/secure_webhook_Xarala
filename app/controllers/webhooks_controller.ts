import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Order from '#models/order'
import PaymentEvent from '#models/payment_event'
import PaymentSignatureService from '#services/payment_signature_service'
import { paymentWebhookValidator } from '#validators/payment_webhook'

export default class WebhooksController {

    
  async handle({ request, response }: HttpContext) {
    const payload = await request.validateUsing(paymentWebhookValidator)

    // 1. Signature d'abord — avant de toucher à la moindre donnée
    const signatureIsValid = PaymentSignatureService.isValid({
      transactionId: payload.transaction_id,
      orderId: payload.order_id,
      amount: payload.amount,
      timestamp: payload.timestamp,
      receivedSignature: payload.signature,
    })

    if (!signatureIsValid) {
      logger.warn({ transactionId: payload.transaction_id }, 'Signature invalide')
      return response.unauthorized({ error: 'invalid_signature' })
    }

    // 2. Retrouver la commande
    const order = await Order.findBy('order_id', payload.order_id)

    if (!order) {
      logger.error({ orderId: payload.order_id }, 'Commande introuvable')
      return response.ok({ status: 'ignored', reason: 'order_not_found' })
    }

    // 3. Idempotence : la contrainte unique DB fait le gros du travail
    const amountMismatch = Number(payload.amount) !== Number(order.amount)

    let paymentEvent: PaymentEvent
    try {
      paymentEvent = await PaymentEvent.create({
        transactionId: payload.transaction_id,
        orderId: order.id,
        status: payload.status,
        amountReceived: payload.amount,
        amountMismatch,
        rawPayload: payload,
        processedAt: DateTime.now(),
      })
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        logger.info({ transactionId: payload.transaction_id }, 'Replay détecté')
        return response.ok({ status: 'already_processed' })
      }
      logger.error({ err: error }, 'Erreur inattendue')
      return response.internalServerError({ error: 'internal_error' })
    }

    // 4. Cohérence du montant
    if (amountMismatch) {
      logger.warn(
        { expected: order.amount, received: payload.amount },
        'Montant incohérent, commande NON validée'
      )
      return response.ok({ status: 'amount_mismatch_logged' })
    }

    // 5. Statut failed envoyé par l'agrégateur
    if (payload.status === 'failed') {
      order.status = 'failed'
      await order.save()
      return response.ok({ status: 'payment_failed_recorded' })
    }

    // 6. Cas nominal : succès -> marquer payé + livrer
    order.status = 'paid'
    await order.save()

    logger.info(
      { orderId: order.orderId, transactionId: paymentEvent.transactionId },
      '[DELIVERY] Accès au cours débloqué (simulation)'
    )

    return response.ok({ status: 'processed' })
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === '23505'
  }
}
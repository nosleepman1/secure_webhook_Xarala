import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Order from '#models/order'
import PaymentEvent from '#models/payment_event'
import PaymentSignatureService from '#services/payment_signature_service'
import { paymentWebhookValidator } from '#validators/payment_webhook'
import triggerCourseDelivery from '#services/delivery_service'

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

    const amountMismatch = Number(payload.amount) !== Number(order.amount)

    // 3. Idempotence : la contrainte unique DB fait le gros du travail.
    // On isole cette tentative dans une SOUS-TRANSACTION (savepoint).
    // Pourquoi : si l'insertion échoue (transaction_id déjà existant),
    // PostgreSQL "empoisonne" la transaction englobante et rejette toute
    // requête suivante tant qu'il n'y a pas eu de rollback. En isolant
    // la tentative dans son propre savepoint, seul CE savepoint est
    // annulé en cas d'échec — le reste (y compris les requêtes des tests
    // qui tournent dans une transaction globale) continue de fonctionner.
    let paymentEvent: PaymentEvent
    try {
      paymentEvent = await db.transaction(async (trx) => {
        return PaymentEvent.create(
          {
            transactionId: payload.transaction_id,
            orderId: order.id,
            status: payload.status,
            amountReceived: payload.amount,
            amountMismatch,
            rawPayload: payload,
            processedAt: DateTime.now(),
          },
          { client: trx }
        )
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

    // 6. Cas nominal : succès -> marquer payé de façon atomique
    await db.transaction(async (trx) => {
      order.useTransaction(trx)
      order.status = 'paid'
      await order.save()
    })

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
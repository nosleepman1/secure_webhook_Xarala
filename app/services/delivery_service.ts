import logger from '@adonisjs/core/services/logger'

/**
 * Simule le déclenchement de la livraison d'accès au cours après un
 * paiement validé. En production, ce serait un appel HTTP vers le
 * service qui débloque l'accès (ou un job en queue pour découpler
 * le webhook de la livraison elle-même).
 *
 * Ici : simulation via log, comme accepté par l'énoncé
 * ("simulée : log ou appel HTTP sortant mocké").
 */
export default async function triggerCourseDelivery(params: {
  orderId: string
  transactionId: string
}): Promise<void> {
  // TODO (avec plus de temps) : remplacer par un vrai appel HTTP vers
  // DELIVERY_SERVICE_URL, avec retry en cas d'échec, et idéalement
  // découplé via une queue (Bull/Redis) pour ne pas bloquer la réponse
  // au webhook sur un service tiers potentiellement lent.
  logger.info(
    { orderId: params.orderId, transactionId: params.transactionId },
    '[DELIVERY] Accès au cours débloqué (simulation)'
  )
}
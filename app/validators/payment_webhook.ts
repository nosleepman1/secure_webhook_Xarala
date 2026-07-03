import vine from '@vinejs/vine'

/**
 * Valide la STRUCTURE du payload envoyé par l'agrégateur.
 * La signature, elle, est vérifiée séparément dans le contrôleur
 * (ce n'est pas une validation de forme, c'est une vérification
 * cryptographique qui a sa propre logique).
 */
export const paymentWebhookValidator = vine.compile(
  vine.object({
    transaction_id: vine.string().trim().minLength(1),
    order_id: vine.string().trim().minLength(1),
    status: vine.enum(['success', 'failed'] as const),
    amount: vine.number().positive(),
    signature: vine.string().trim().minLength(1),
    timestamp: vine.number(),
  })
)
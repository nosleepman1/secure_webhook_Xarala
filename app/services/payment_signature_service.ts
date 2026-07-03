import crypto from 'node:crypto'
import env from '#start/env'

export default class PaymentSignatureService {
  /**
   * Construit la chaîne canonique à signer.
   * L'ordre des champs doit être fixe — c'est un contrat avec l'agrégateur.
   */
  private static buildPayloadToSign(params: {
    transactionId: string
    orderId: string
    amount: number
    timestamp: number
  }): string {
    return `${params.transactionId}|${params.orderId}|${params.amount}|${params.timestamp}`
  }

  static computeSignature(params: {
    transactionId: string
    orderId: string
    amount: number
    timestamp: number
  }): string {
    const secret = env.get('PAYMENT_WEBHOOK_SECRET')
    const payload = this.buildPayloadToSign(params)
    return crypto.createHmac('sha256', secret).update(payload).digest('hex')
  }

  static isValid(params: {
    transactionId: string
    orderId: string
    amount: number
    timestamp: number
    receivedSignature: string
  }): boolean {
    const expected = this.computeSignature(params)
    const expectedBuffer = Buffer.from(expected, 'hex')
    const receivedBuffer = Buffer.from(params.receivedSignature, 'hex')

    // Buffers de tailles différentes -> signature invalide (et on évite
    // que timingSafeEqual plante si les longueurs diffèrent)
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false
    }

    // timingSafeEqual plutôt que "===" : évite qu'un attaquant devine la
    // signature en mesurant le temps de comparaison caractère par caractère
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  }
}
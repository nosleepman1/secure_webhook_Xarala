import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export default class RegistrationWebhookService {
  static async notify(payload: {
    name: string
    email: string
    phoneWhatsapp: string
    city: string
  }): Promise<void> {
    const webhookUrl = env.get('AUTOMATION_WEBHOOK_URL')

    if (!webhookUrl) {
      logger.warn('AUTOMATION_WEBHOOK_URL is not configured; skipping registration notification')
      return
    }

    const delays = [1000, 2000, 4000]

    for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            type: 'registration_created',
            data: payload,
          }),
        })

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}`)
        }

        logger.info({ email: payload.email }, 'Registration notification sent successfully')
        return
      } catch (error) {
        const isLastAttempt = attempt === delays.length + 1

        if (isLastAttempt) {
          logger.error({ err: error, email: payload.email }, 'Registration notification failed after retries')
          return
        }

        const delay = delays[attempt - 1]
        logger.warn({ attempt, delay, email: payload.email }, 'Registration notification attempt failed; retrying')
        await this.sleep(delay)
      }
    }
  }

  private static sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

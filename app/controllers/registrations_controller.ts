import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Registration from '#models/registration'
import RegistrationWebhookService from '#services/registration_webhook_service'
import { registrationValidator } from '#validators/registration'

export default class RegistrationsController {
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registrationValidator)

    try {
      const registration = await db.transaction(async (trx) => {
        return Registration.create(
          {
            name: payload.name,
            email: payload.email,
            phoneWhatsapp: payload.phone_whatsapp,
            city: payload.city,
          },
          { client: trx }
        )
      })

      await RegistrationWebhookService.notify({
        name: registration.name,
        email: registration.email,
        phoneWhatsapp: registration.phoneWhatsapp,
        city: registration.city,
      })

      return response.created({
        success: true,
        message: 'Registration created successfully',
        data: {
          id: registration.id,
          name: registration.name,
          email: registration.email,
          phone_whatsapp: registration.phoneWhatsapp,
          city: registration.city,
        },
      })
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        logger.warn({ email: payload.email, phone: payload.phone_whatsapp }, 'Duplicate registration attempt')
        return response.conflict({ error: 'duplicate_registration' })
      }

      logger.error({ err: error }, 'Failed to create registration')
      return response.internalServerError({ error: 'internal_error' })
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === '23505'
  }
}

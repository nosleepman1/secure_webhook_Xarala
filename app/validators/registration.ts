import vine from '@vinejs/vine'

export const registrationValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    email: vine.string().trim().email(),
    phone_whatsapp: vine.string().trim().regex(/^\+221[0-9]{9}$/),
    city: vine.string().trim().minLength(2).maxLength(100),
  })
)

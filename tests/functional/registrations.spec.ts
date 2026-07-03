import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Registration from '#models/registration'

test.group('Registrations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('une inscription valide retourne 201 et crée l\'enregistrement', async ({ client, assert }) => {
    const response = await client.post('/registrations').json({
      name: 'Mamadou Diop',
      email: 'mamadou@example.com',
      phone_whatsapp: '+221771234567',
      city: 'Dakar',
    })

    response.assertStatus(201)
    response.assertBodyContains({
      success: true,
      message: 'Registration created successfully',
    })

    const registration = await Registration.findByOrFail('email', 'mamadou@example.com')
    assert.equal(registration.name, 'Mamadou Diop')
    assert.equal(registration.city, 'Dakar')
  })

  test('une deuxième inscription avec le même email retourne 409', async ({ client, assert }) => {
    await Registration.create({
      name: 'Mamadou Diop',
      email: 'dup@example.com',
      phoneWhatsapp: '+221771234568',
      city: 'Thiès',
    })

    const response = await client.post('/registrations').json({
      name: 'Mamadou Deux',
      email: 'dup@example.com',
      phone_whatsapp: '+221771234569',
      city: 'Saint-Louis',
    })

    response.assertStatus(409)
    response.assertBodyContains({ error: 'duplicate_registration' })

    const registrations = await Registration.query().where('email', 'dup@example.com')
    assert.lengthOf(registrations, 1)
  })

  test('une deuxième inscription avec le même téléphone retourne aussi 409', async ({ client, assert }) => {
    await Registration.create({
      name: 'Awa Ndiaye',
      email: 'awa@example.com',
      phoneWhatsapp: '+221771234520',
      city: 'Kaolack',
    })

    const response = await client.post('/registrations').json({
      name: 'Youssou Fall',
      email: 'youssou@example.com',
      phone_whatsapp: '+221771234520',
      city: 'Ziguinchor',
    })

    response.assertStatus(409)
    response.assertBodyContains({ error: 'duplicate_registration' })

    const registrations = await Registration.query().where('phone_whatsapp', '+221771234520')
    assert.lengthOf(registrations, 1)
  })

  test('un téléphone mal formaté retourne 422', async ({ client }) => {
    const response = await client.post('/registrations').json({
      name: 'Bad Number',
      email: 'bad@example.com',
      phone_whatsapp: '771234567',
      city: 'Dakar',
    })

    response.assertStatus(422)
  })

  test('un email mal formaté retourne 422', async ({ client }) => {
    const response = await client.post('/registrations').json({
      name: 'Bad Email',
      email: 'not-an-email',
      phone_whatsapp: '+221771234571',
      city: 'Dakar',
    })

    response.assertStatus(422)
  })

  test('dépasser la limite de rate limiting retourne 429 sur la 6ème requête', async ({ client }) => {
    await limiter.clear(['memory', 'redis'])

    for (let index = 0; index < 5; index++) {
      const response = await client.post('/registrations').json({
        name: `User ${index}`,
        email: `user${index}@example.com`,
        phone_whatsapp: `+2217712345${index + 60}`,
        city: 'Dakar',
      })

      if (index < 4) {
        response.assertStatus(201)
      }
    }

    const response = await client.post('/registrations').json({
      name: 'User 5',
      email: 'user5@example.com',
      phone_whatsapp: '+221771234565',
      city: 'Dakar',
    })

    response.assertStatus(429)
  })
})

/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
// import { controllers } from '#generated/controllers'
import WebhooksController from '#controllers/webhooks_controller'
import RegistrationsController from '#controllers/registrations_controller'

router.post('/webhooks/payment', [WebhooksController, 'handle'])

router.post('/registrations', [ RegistrationsController, 'store'])
  .use(middleware.registrationRateLimit())



// router
//   .group(() => {
//     router
//       .group(() => {
//         router.post('signup', [controllers.NewAccount, 'store'])
//         router.post('login', [controllers.AccessTokens, 'store'])
//       })
//       .prefix('auth')
//       .as('auth')

//     router
//       .group(() => {
//         router.get('profile', [controllers.Profile, 'show'])
//         router.post('logout', [controllers.AccessTokens, 'destroy'])
//       })
//       .prefix('account')
//       .as('profile')
//       .use(middleware.auth())

    
//   })
//   .prefix('/api/v1')

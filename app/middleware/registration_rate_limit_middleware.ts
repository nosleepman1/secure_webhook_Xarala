import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import limiter from '@adonisjs/limiter/services/main'

export default class RegistrationRateLimitMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const ipAddress = ctx.request.ip() ?? 'unknown'

    // Lightweight anti-bot option: add a honeypot field or enforce a small delay
    // between page rendering and submission on the frontend. It is not implemented
    // here to keep the scope focused on the server-side protection requested.
    try {
      await limiter
        .allowRequests(5)
        .every('1 minute')
        .blockFor('5 minutes')
        .usingKey(ipAddress)
        .throttle('registrations', ctx)
    } catch {
      logger.warn({ ip: ipAddress }, 'Registration rate limit exceeded')
      return ctx.response.tooManyRequests({ error: 'rate_limit_exceeded' })
    }

    return next()
  }
}

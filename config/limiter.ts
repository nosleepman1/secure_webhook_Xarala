import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterStore = env.get('LIMITER_STORE') === 'redis' ? 'memory' : env.get('LIMITER_STORE')

const limiterConfig = defineConfig({
  default: limiterStore || 'memory',
  stores: {
    /**
     * Redis store to save rate limiting data inside a
     * redis database.
     */
    redis: stores.redis({}),

    /**
     * Memory store is used by default to keep local/test runs deterministic.
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
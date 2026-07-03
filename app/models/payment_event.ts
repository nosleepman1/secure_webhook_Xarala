import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Order from './order.js'

export default class PaymentEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare transactionId: string

  @column()
  declare orderId: number

  @column()
  declare status: 'success' | 'failed'

  @column()
  declare amountReceived: number

  @column()
  declare amountMismatch: boolean

  @column({
    prepare: (value: object) => JSON.stringify(value),
  })
  declare rawPayload: object

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>

  @column.dateTime()
  declare processedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
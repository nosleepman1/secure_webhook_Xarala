import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import PaymentEvent from './payment_event.js'

export default class Order extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderId: string

  @column()
  declare amount: number

  @column()
  declare status: 'pending' | 'paid' | 'failed'

  @hasMany(() => PaymentEvent)
  declare paymentEvents: HasMany<typeof PaymentEvent>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
  
}
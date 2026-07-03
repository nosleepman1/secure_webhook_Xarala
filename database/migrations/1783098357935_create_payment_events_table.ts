import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Contrainte unique = protection anti-replay au niveau DB,
      // atomique même en cas de requêtes simultanées
      table.string('transaction_id').notNullable().unique()

      table.integer('order_id').unsigned().references('id').inTable('orders').onDelete('CASCADE')
      table.enum('status', ['success', 'failed']).notNullable()
      table.decimal('amount_received', 12, 2).notNullable()
      table.boolean('amount_mismatch').notNullable().defaultTo(false)
      table.jsonb('raw_payload').notNullable()
      table.timestamp('processed_at').notNullable()
      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
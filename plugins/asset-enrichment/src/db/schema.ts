import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  blockchain: text('blockchain').notNull(),
  namespace: text('namespace').notNull(),
  reference: text('reference').notNull(),
  symbol: text('symbol').notNull(),
  name: text('name'),
  decimals: integer('decimals').notNull(),
  iconUrl: text('icon_url'),
  chainId: integer('chain_id'),
  
  source: text('source').notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ([
  index('blockchain_reference_idx').on(table.blockchain, table.reference),
  index('symbol_idx').on(table.symbol),
  index('blockchain_idx').on(table.blockchain),
]));

export const coingeckoIds = sqliteTable('coingecko_ids', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
}, (table) => ([
  index('coingecko_symbol_idx').on(table.symbol),
]));

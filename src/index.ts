/**
 * Kysely driver for Bun's native SQL runtime
 *
 * Provides PostgreSQL, MySQL, and SQLite support through Bun's built-in SQL API.
 *
 * @example
 * ```ts
 * import { Kysely } from 'kysely'
 * import { BunSQLDialect } from 'kysely-bun-sql'
 * import { SQL } from 'bun'
 *
 * interface Database {
 *   users: {
 *     id: number
 *     name: string
 *     email: string
 *   }
 * }
 *
 * // Connect to PostgreSQL
 * const db = new Kysely<Database>({
 *   dialect: new BunSQLDialect({
 *     database: new SQL('postgres://user:pass@localhost/mydb'),
 *   }),
 * })
 *
 * // Query
 * const users = await db.selectFrom('users').selectAll().execute()
 * ```
 */

export { BunSQLDialect } from "./dialect";
export type { BunSQLOptions } from "./config";

import type { SQL } from "bun";

/**
 * Configuration options for BunSQL dialect
 *
 * @example
 * ```ts
 * import { BunSQLDialect } from 'kysely-bun-sql'
 * import { SQL } from 'bun'
 *
 * // Using connection string (PostgreSQL)
 * const database = new SQL('postgres://user:password@localhost:5432/mydb')
 *
 * // Using MySQL
 * const mysqlDb = new SQL('mysql://user:password@localhost:3306/mydb')
 *
 * // Using SQLite
 * const sqliteDb = new SQL('sqlite://./app.db')
 * // Or in-memory
 * const memoryDb = new SQL(':memory:')
 *
 * // Using options object (PostgreSQL)
 * const database = new SQL({
 *   hostname: 'localhost',
 *   port: 5432,
 *   database: 'myapp',
 *   username: 'user',
 *   password: 'secret',
 *   max: 20,
 *   idleTimeout: 30,
 *   tls: true,
 * })
 *
 * // Create Kysely instance
 * const db = new Kysely<Database>({
 *   dialect: new BunSQLDialect({ database }),
 * })
 * ```
 */
export interface BunSQLOptions {
	/**
	 * A pre-configured Bun SQL instance
	 *
	 * Bun automatically detects the database type based on the connection string:
	 * - URLs starting with `postgres://` or `postgresql://` use PostgreSQL
	 * - URLs starting with `mysql://` or `mysql2://` use MySQL
	 * - URLs matching SQLite patterns (`:memory:`, `sqlite://`, `file://`) use SQLite
	 *
	 * You can also use environment variables:
	 * - `DATABASE_URL` - Primary connection URL
	 * - `POSTGRES_URL` - PostgreSQL-specific URL
	 * - `MYSQL_URL` - MySQL-specific URL
	 * - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - PostgreSQL env vars
	 * - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` - MySQL env vars
	 */
	database: SQL;
}

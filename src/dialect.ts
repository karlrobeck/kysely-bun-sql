import type {
	DatabaseIntrospector,
	Dialect,
	DialectAdapter,
	Driver,
	Kysely,
	QueryCompiler,
} from "kysely";
import {
	MysqlAdapter,
	MysqlIntrospector,
	MysqlQueryCompiler,
	PostgresAdapter,
	PostgresIntrospector,
	PostgresQueryCompiler,
	SqliteAdapter,
	SqliteIntrospector,
	SqliteQueryCompiler,
} from "kysely";
import { BunSQLDriver } from "./driver";
import type { BunSQLOptions } from "./config";

/**
 * Bun SQL Dialect for Kysely
 *
 * Provides support for PostgreSQL, MySQL, and SQLite databases through Bun's native SQL runtime.
 * The dialect automatically detects the database type based on the connection string.
 *
 * Example usage:
 * ```ts
 * import { BunSQLDialect } from 'kysely-bun-sql'
 * import { SQL } from 'bun'
 *
 * const database = new SQL('postgres://...')
 *
 * const db = new Kysely<Database>({
 *   dialect: new BunSQLDialect({ database }),
 * })
 * ```
 */
export class BunSQLDialect implements Dialect {
	readonly #options: BunSQLOptions;

	constructor(options: BunSQLOptions) {
		this.#options = options;
	}

	createDriver(): Driver {
		return new BunSQLDriver(this.#options.database);
	}

	createQueryCompiler(): QueryCompiler {
		switch (this.#options.database.options.adapter) {
			case "sqlite":
				return new SqliteQueryCompiler();
			case "mariadb":
				return new MysqlQueryCompiler();
			case "mysql":
				return new MysqlQueryCompiler();
			case "postgres":
				return new PostgresQueryCompiler();
			default:
				return new PostgresQueryCompiler();
		}
	}

	createAdapter(): DialectAdapter {
		switch (this.#options.database.options.adapter) {
			case "sqlite":
				return new SqliteAdapter();
			case "mariadb":
				return new MysqlAdapter();
			case "mysql":
				return new MysqlAdapter();
			case "postgres":
				return new PostgresAdapter();
			default:
				return new PostgresAdapter();
		}
	}

	createIntrospector(
		db: Kysely<Record<string, unknown>>,
	): DatabaseIntrospector {
		switch (this.#options.database.options.adapter) {
			case "sqlite":
				return new SqliteIntrospector(db);
			case "mariadb":
				return new MysqlIntrospector(db);
			case "mysql":
				return new MysqlIntrospector(db);
			case "postgres":
				return new PostgresIntrospector(db);
			default:
				return new PostgresIntrospector(db);
		}
	}
}

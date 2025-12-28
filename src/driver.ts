import type { ReservedSQL, SQL } from "bun";
import {
	CompiledQuery,
	type DatabaseConnection,
	type Driver,
	type QueryResult,
	type TransactionSettings,
} from "kysely";

/**
 * Bun SQL Driver for Kysely
 * Provides support for PostgreSQL, MySQL, and SQLite via Bun's native SQL runtime
 */
export class BunSQLDriver implements Driver {
	readonly #database: SQL;

	#connection?: ReservedSQL;

	constructor(database: SQL) {
		this.#database = database;
	}

	async init(): Promise<void> {
		// Bun SQL is already initialized, nothing to do here
	}

	async acquireConnection(): Promise<DatabaseConnection> {
		if (this.#database.options.adapter === "sqlite") {
			return new BunSQLConnection(this.#database);
		}
		this.#connection = await this.#database.reserve();
		return new BunSQLConnection(this.#connection);
	}

	async beginTransaction(
		connection: DatabaseConnection,
		settings?: TransactionSettings,
	): Promise<void> {
		if (settings?.isolationLevel || settings?.accessMode) {
			let sql = "start transaction";

			if (settings?.isolationLevel) {
				sql += ` isolation level ${settings.isolationLevel}`;
			}

			if (settings?.accessMode) {
				sql += ` ${settings.accessMode}`;
			}

			await connection.executeQuery(CompiledQuery.raw(sql));
		} else {
			await connection.executeQuery(CompiledQuery.raw("begin"));
		}
	}

	async commitTransaction(connection: DatabaseConnection): Promise<void> {
		await connection.executeQuery(CompiledQuery.raw("commit"));
	}

	async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
		await connection.executeQuery(CompiledQuery.raw("rollback"));
	}

	async releaseConnection(): Promise<void> {
		if (this.#connection) {
			this.#connection.release();
		}
	}

	async destroy(): Promise<void> {
		await this.#database.close();
	}
}

/**
 * Bun SQL Connection - wraps a Bun SQL instance
 * Handles query execution and result mapping
 */
class BunSQLConnection implements DatabaseConnection {
	readonly #db: ReservedSQL | SQL;

	constructor(db: ReservedSQL | SQL) {
		this.#db = db;
	}

	async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
		const { sql, parameters } = compiledQuery;

		try {
			// Execute the query using Bun's SQL API with unsafe for dynamic SQL
			const result = await this.#db.unsafe<unknown>(sql, [...parameters]);

			// Check if result is an array (SELECT query)
			if (Array.isArray(result)) {
				return {
					rows: result as O[],
				};
			}

			// Handle non-array results (shouldn't happen with unsafe)
			return {
				rows: [] as O[],
			};
		} catch (error) {
			throw new Error(
				`Bun SQL query execution failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	streamQuery<R>(
		compiledQuery: CompiledQuery,
		_chunkSize?: number,
	): AsyncIterableIterator<QueryResult<R>> {
		// Streaming is not yet supported by Bun's SQL API
		// Return an async generator that yields all results at once
		const self = this;

		async function* generator() {
			const results = await self.executeQuery<R>(compiledQuery);
			yield results;
		}

		return generator();
	}
}

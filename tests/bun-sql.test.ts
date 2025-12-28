import { describe, it, beforeEach, expect } from "bun:test";
import { SQL } from "bun";
import { Kysely, sql } from "kysely";
import type { Generated } from "kysely";
import { BunSQLDialect } from "../src";

// Database interfaces
interface Database {
	users: UserTable;
	posts: PostTable;
}

interface UserTable {
	id: Generated<number>;
	name: string;
	email: string;
	createdAt: Generated<string>;
}

interface PostTable {
	id: Generated<number>;
	userId: number;
	title: string;
	content: string;
	createdAt: Generated<string>;
}

// Helper to create a fresh database for each test
function createDatabase(): Kysely<Database> {
	const database = new SQL(":memory:");
	return new Kysely<Database>({
		dialect: new BunSQLDialect({ database }),
	});
}

describe("Bun SQL Driver Integration Tests", () => {
	// ============ TABLE CREATION ============
	describe("Table Creation", () => {
		it("should create a table successfully", async () => {
			const db = createDatabase();

			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull().unique())
				.addColumn("createdAt", "timestamp", (col) =>
					col.defaultTo(sql`CURRENT_TIMESTAMP`),
				)
				.execute();

			const tables = await db.introspection.getTables();
			expect(tables.length).toBe(1);
			const table = tables.at(0);
			expect(table?.name).toBe("users");
		});

		it("should create multiple tables", async () => {
			const db = createDatabase();

			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.execute();

			await db.schema
				.createTable("posts")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("userId", "integer", (col) => col.notNull())
				.addColumn("title", "text", (col) => col.notNull())
				.execute();

			const tables = await db.introspection.getTables();
			expect(tables.length).toBe(2);
			expect(tables.map((t) => t.name).sort()).toEqual(
				["posts", "users"].sort(),
			);
		});
	});

	// ============ CREATE (INSERT) ============
	describe("INSERT Operations", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.addColumn("createdAt", "timestamp", (col) =>
					col.defaultTo(sql`CURRENT_TIMESTAMP`),
				)
				.execute();
		});

		it("should insert a single record", async () => {
			const result = await db
				.insertInto("users")
				.values({
					name: "John Doe",
					email: "john@example.com",
				})
				.returning("id")
				.executeTakeFirst();

			expect(result).toBeDefined();
			expect(result?.id).toBe(1);
		});

		it("should insert multiple records", async () => {
			const results = await db
				.insertInto("users")
				.values([
					{ name: "John Doe", email: "john@example.com" },
					{ name: "Jane Smith", email: "jane@example.com" },
					{ name: "Bob Johnson", email: "bob@example.com" },
				])
				.returning("id")
				.execute();

			expect(results.length).toBe(3);
			expect(results[0]?.id).toBe(1);
			expect(results[1]?.id).toBe(2);
			expect(results[2]?.id).toBe(3);
		});

		it("should insert and return full record", async () => {
			const result = await db
				.insertInto("users")
				.values({
					name: "Alice Wonder",
					email: "alice@example.com",
				})
				.returningAll()
				.executeTakeFirst();

			expect(result?.name).toBe("Alice Wonder");
			expect(result?.email).toBe("alice@example.com");
			expect(result?.id).toBeDefined();
		});
	});

	// ============ READ (SELECT) ============
	describe("SELECT Operations", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.addColumn("createdAt", "timestamp")
				.execute();

			// Insert test data
			await db
				.insertInto("users")
				.values([
					{ name: "John Doe", email: "john@example.com" },
					{ name: "Jane Smith", email: "jane@example.com" },
					{ name: "Bob Johnson", email: "bob@example.com" },
				])
				.execute();
		});

		it("should select all records", async () => {
			const users = await db.selectFrom("users").selectAll().execute();

			expect(users.length).toBe(3);
			expect(users[0]?.name).toBe("John Doe");
		});

		it("should select specific columns", async () => {
			const users = await db
				.selectFrom("users")
				.select(["id", "name"])
				.execute();

			expect(users.length).toBe(3);
			expect(users[0]).toHaveProperty("id");
			expect(users[0]).toHaveProperty("name");
			expect(users[0]).not.toHaveProperty("email");
		});

		it("should select with WHERE clause", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", 2)
				.executeTakeFirst();

			expect(user?.name).toBe("Jane Smith");
			expect(user?.email).toBe("jane@example.com");
		});

		it("should select with LIKE operator", async () => {
			const users = await db
				.selectFrom("users")
				.selectAll()
				.where("name", "like", "%John%")
				.execute();

			expect(users.length).toBe(2);
		});

		it("should count records", async () => {
			const result = await db
				.selectFrom("users")
				.select((eb) => eb.fn.count<number>("id").as("count"))
				.executeTakeFirst();

			expect(result?.count).toBe(3);
		});

		it("should select single record", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("name", "=", "John Doe")
				.executeTakeFirst();

			expect(user?.name).toBe("John Doe");
		});
	});

	// ============ UPDATE ============
	describe("UPDATE Operations", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.execute();

			await db
				.insertInto("users")
				.values([
					{ name: "John Doe", email: "john@example.com" },
					{ name: "Jane Smith", email: "jane@example.com" },
				])
				.execute();
		});

		it("should update a single record", async () => {
			await db
				.updateTable("users")
				.set({ email: "john.updated@example.com" })
				.where("id", "=", 1)
				.execute();

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", 1)
				.executeTakeFirst();

			expect(user?.email).toBe("john.updated@example.com");
		});

		it("should update multiple records", async () => {
			await db
				.updateTable("users")
				.set({ name: sql`UPPER(name)` })
				.where("id", ">", 0)
				.execute();

			const users = await db.selectFrom("users").selectAll().execute();

			expect(users[0]?.name).toBe("JOHN DOE");
			expect(users[1]?.name).toBe("JANE SMITH");
		});

		it("should update and return updated record", async () => {
			const updated = await db
				.updateTable("users")
				.set({ email: "jane.new@example.com" })
				.where("id", "=", 2)
				.returning(["id", "name", "email"])
				.executeTakeFirst();

			expect(updated?.email).toBe("jane.new@example.com");
			expect(updated?.name).toBe("Jane Smith");
		});
	});

	// ============ DELETE ============
	describe("DELETE Operations", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.execute();

			await db
				.insertInto("users")
				.values([
					{ name: "John Doe", email: "john@example.com" },
					{ name: "Jane Smith", email: "jane@example.com" },
					{ name: "Bob Johnson", email: "bob@example.com" },
				])
				.execute();
		});

		it("should delete a single record", async () => {
			await db.deleteFrom("users").where("id", "=", 1).execute();

			const users = await db.selectFrom("users").selectAll().execute();
			expect(users.length).toBe(2);
		});

		it("should delete multiple records", async () => {
			await db.deleteFrom("users").where("id", ">=", 2).execute();

			const users = await db.selectFrom("users").selectAll().execute();
			expect(users.length).toBe(1);
			expect(users[0]?.name).toBe("John Doe");
		});

		it("should delete with WHERE clause", async () => {
			await db.deleteFrom("users").where("email", "like", "bob%").execute();

			const users = await db.selectFrom("users").selectAll().execute();
			expect(users.length).toBe(2);
			expect(users.some((u) => u.name === "Bob Johnson")).toBeFalsy();
		});
	});

	// ============ TRANSACTIONS ============
	describe("Transactions", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.execute();
		});

		it("should commit transaction on success", async () => {
			await db.transaction().execute(async (trx) => {
				await trx
					.insertInto("users")
					.values({
						name: "Transaction User",
						email: "transaction@example.com",
					})
					.execute();
			});

			const users = await db.selectFrom("users").selectAll().execute();
			expect(users.length).toBe(1);
			expect(users[0]?.name).toBe("Transaction User");
		});

		it("should rollback transaction on error", async () => {
			try {
				await db.transaction().execute(async (trx) => {
					await trx
						.insertInto("users")
						.values({
							name: "Will Rollback",
							email: "rollback@example.com",
						})
						.execute();

					throw new Error("Intentional error");
				});
			} catch {
				// Expected error
			}

			const users = await db.selectFrom("users").selectAll().execute();
			expect(users.length).toBe(0);
		});

		it("should execute multiple operations in transaction", async () => {
			await db.transaction().execute(async (trx) => {
				const user1 = await trx
					.insertInto("users")
					.values({
						name: "User 1",
						email: "user1@example.com",
					})
					.returning("id")
					.executeTakeFirstOrThrow();

				await trx
					.insertInto("users")
					.values({
						name: "User 2",
						email: "user2@example.com",
					})
					.returning("id")
					.executeTakeFirst();

				await trx
					.updateTable("users")
					.set({ name: "Updated User 1" })
					.where("id", "=", user1.id)
					.execute();
			});

			const users = await db
				.selectFrom("users")
				.selectAll()
				.orderBy("id")
				.execute();

			expect(users.length).toBe(2);
			expect(users[0]?.name).toBe("Updated User 1");
			expect(users[1]?.name).toBe("User 2");
		});
	});

	// ============ RAW SQL ============
	describe("Raw SQL", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.execute();

			await db
				.insertInto("users")
				.values([
					{ name: "John Doe", email: "john@example.com" },
					{ name: "Jane Smith", email: "jane@example.com" },
					{ name: "Bob Johnson", email: "bob@example.com" },
				])
				.execute();
		});

		it("should execute raw SELECT query", async () => {
			const result = await sql<{ count: number }>`
				SELECT COUNT(*) as count FROM users
			`.execute(db);

			expect(result.rows.length).toBe(1);
			expect(result.rows[0]?.count).toBe(3);
		});

		it("should execute raw INSERT query", async () => {
			const result = await sql`
				INSERT INTO users (name, email) 
				VALUES ('Alice Wonder', 'alice@example.com')
				RETURNING id
			`.execute(db);

			expect(result.rows.length).toBe(1);
			const insertRow = result.rows[0] as unknown as { id: number };
			expect(insertRow.id).toBe(4);
		});

		it("should execute raw UPDATE query", async () => {
			await sql`
				UPDATE users 
				SET name = 'Updated John' 
				WHERE id = 1
			`.execute(db);

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", 1)
				.executeTakeFirst();

			expect(user?.name).toBe("Updated John");
		});

		it("should execute raw DELETE query", async () => {
			await sql`DELETE FROM users WHERE id = 1`.execute(db);

			const users = await db.selectFrom("users").selectAll().execute();
			expect(users.length).toBe(2);
		});

		it("should execute raw query with parameters", async () => {
			const result = await sql<{ name: string; email: string }>`
				SELECT name, email FROM users WHERE id = ${2}
			`.execute(db);

			expect(result.rows.length).toBe(1);
			expect(result.rows[0]?.name).toBe("Jane Smith");
		});

		it("should execute raw query with multiple parameters", async () => {
			const result = await sql<{ name: string }>`
				SELECT name FROM users WHERE id > ${1} AND id < ${3}
			`.execute(db);

			expect(result.rows.length).toBe(1);
			expect(result.rows[0]?.name).toBe("Jane Smith");
		});
	});

	// ============ COMPLEX QUERIES ============
	describe("Complex Queries", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();

			// Create tables
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull())
				.execute();

			// Insert users
			await db
				.insertInto("users")
				.values([
					{ name: "John Doe", email: "john@example.com" },
					{ name: "Jane Smith", email: "jane@example.com" },
				])
				.execute();
		});

		it("should order results", async () => {
			const users = await db
				.selectFrom("users")
				.selectAll()
				.orderBy("name")
				.execute();

			expect(users[0]?.name).toBe("Jane Smith");
			expect(users[1]?.name).toBe("John Doe");
		});

		it("should limit results", async () => {
			const users = await db.selectFrom("users").selectAll().limit(1).execute();

			expect(users.length).toBe(1);
		});

		it("should offset results", async () => {
			const users = await db
				.selectFrom("users")
				.selectAll()
				.orderBy("id")
				.limit(10)
				.offset(1)
				.execute();

			expect(users.length).toBe(1);
			expect(users[0]?.name).toBe("Jane Smith");
		});

		it("should combine WHERE, ORDER BY, LIMIT", async () => {
			const users = await db
				.selectFrom("users")
				.selectAll()
				.where("id", ">=", 1)
				.orderBy("name")
				.limit(1)
				.execute();

			expect(users.length).toBe(1);
			expect(users[0]?.name).toBe("Jane Smith");
		});
	});

	// ============ ERROR HANDLING ============
	describe("Error Handling", () => {
		let db: Kysely<Database>;

		beforeEach(async () => {
			db = createDatabase();
			await db.schema
				.createTable("users")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("name", "text", (col) => col.notNull())
				.addColumn("email", "text", (col) => col.notNull().unique())
				.execute();
		});

		it("should handle duplicate key error gracefully", async () => {
			await db
				.insertInto("users")
				.values({
					name: "John Doe",
					email: "john@example.com",
				})
				.execute();

			try {
				await db
					.insertInto("users")
					.values({
						name: "Jane Doe",
						email: "john@example.com",
					})
					.execute();

				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeDefined();
			}
		});

		it("should handle invalid column gracefully", async () => {
			try {
				await sql`SELECT invalid_column FROM users`.execute(db);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});
});

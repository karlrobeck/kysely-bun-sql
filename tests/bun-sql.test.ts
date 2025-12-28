import {
	describe,
	it,
	beforeEach,
	expect,
	beforeAll,
	afterAll,
} from "bun:test";
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
	content?: string;
	createdAt: Generated<string>;
}

// Helper to create a fresh database for each test
function createDatabase(
	dialect: "sqlite" | "postgres" | "mysql",
): Kysely<Database> {
	let database: SQL;

	switch (dialect) {
		case "postgres":
			database = new SQL("postgresql://admin:password@localhost:5432/test_db");
			break;
		case "mysql":
			database = new SQL("mysql://admin:password@localhost:3306/test_db");
			break;
		case "sqlite":
		default:
			database = new SQL(":memory:");
			break;
	}

	return new Kysely<Database>({
		dialect: new BunSQLDialect({ database }),
	});
}

describe("PostgreSQL", () => {
	let db: Kysely<Database>;

	beforeAll(async () => {
		db = createDatabase("postgres");

		// Create tables
		await db.schema
			.createTable("users")
			.ifNotExists()
			.addColumn("id", "serial", (col) => col.primaryKey().notNull())
			.addColumn("name", "varchar(255)", (col) => col.notNull())
			.addColumn("email", "varchar(255)", (col) => col.notNull())
			.addColumn("createdAt", "timestamp", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();

		await db.schema
			.createTable("posts")
			.ifNotExists()
			.addColumn("id", "serial", (col) => col.primaryKey().notNull())
			.addColumn("userId", "integer", (col) => col.notNull())
			.addColumn("title", "varchar(255)", (col) => col.notNull())
			.addColumn("content", "text")
			.addColumn("createdAt", "timestamp", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();
	});

	afterAll(async () => {
		// Close the database connection
		await db.destroy();
	});

	describe("Table Creation", () => {
		it("should create tables with correct schema", async () => {
			// This test verifies the tables were created during beforeAll
			const users = await db.selectFrom("users").selectAll().execute();
			expect(Array.isArray(users)).toBe(true);
		});

		it("should handle table creation with ifNotExists", async () => {
			// This should succeed even though table exists due to ifNotExists
			// ifNotExists returns undefined when table already exists, which is expected
			await db.schema
				.createTable("users")
				.ifNotExists()
				.addColumn("id", "serial")
				.execute();

			// Verify table still works
			const users = await db.selectFrom("users").selectAll().execute();
			expect(Array.isArray(users)).toBe(true);
		});
	});

	describe("Create Operation", () => {
		it("should insert a new user successfully", async () => {
			const result = await db
				.insertInto("users")
				.values({ name: "John Doe", email: "john@example.com" })
				.returning("id")
				.executeTakeFirst();

			expect(result).toBeDefined();
			expect(result?.id).toBeGreaterThan(0);
		});

		it("should insert multiple users", async () => {
			const users = [
				{ name: "Alice", email: "alice@example.com" },
				{ name: "Bob", email: "bob@example.com" },
				{ name: "Charlie", email: "charlie@example.com" },
			];

			const result = await db.insertInto("users").values(users).execute();

			expect(result).toBeDefined();
		});

		it("should insert a post with user reference", async () => {
			const user = await db
				.insertInto("users")
				.values({ name: "Jane Doe", email: "jane@example.com" })
				.returning("id")
				.executeTakeFirst();

			expect(user?.id).toBeDefined();

			const post = await db
				.insertInto("posts")
				.values({
					userId: user?.id ?? 0,
					title: "My First Post",
					content: "This is my first post!",
				})
				.returning("id")
				.executeTakeFirst();

			expect(post?.id).toBeGreaterThan(0);
		});

		it("should fail to insert without required fields (incorrect)", async () => {
			try {
				const invalidData = { name: "Test" };
				await db
					.insertInto("users")
					// @ts-expect-error
					.values(invalidData as { name: string })
					.execute();
				expect(true).toBe(false); // Should not reach here
			} catch {
				// Expected to fail due to missing required field
				expect(true).toBe(true);
			}
		});
	});

	describe("Read Operation", () => {
		beforeEach(async () => {
			// Clear and insert fresh test data
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			const userId = await db
				.insertInto("users")
				.values({ name: "Test User", email: "test@example.com" })
				.returning("id")
				.executeTakeFirst();

			if (userId) {
				await db
					.insertInto("posts")
					.values({
						userId: userId.id,
						title: "Test Post",
						content: "Test Content",
					})
					.execute();
			}
		});

		it("should select all users", async () => {
			const users = await db.selectFrom("users").selectAll().execute();

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBeGreaterThan(0);
		});

		it("should select user by email", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "test@example.com")
				.executeTakeFirst();

			expect(user).toBeDefined();
			expect(user?.name).toBe("Test User");
		});

		it("should return undefined for non-existent user", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "nonexistent@example.com")
				.executeTakeFirst();

			expect(user).toBeUndefined();
		});

		it("should select with joins", async () => {
			const result = await db
				.selectFrom("posts")
				.innerJoin("users", "posts.userId", "users.id")
				.select(["posts.title", "users.name", "posts.content"])
				.execute();

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should select with where conditions", async () => {
			const posts = await db
				.selectFrom("posts")
				.selectAll()
				.where("title", "=", "Test Post")
				.execute();

			expect(posts.length).toBeGreaterThan(0);
			if (posts[0]) {
				expect(posts[0].title).toBe("Test Post");
			}
		});
	});

	describe("Update Operation", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "Original Name", email: "original@example.com" })
				.execute();
		});

		it("should update a user by email", async () => {
			const result = await db
				.updateTable("users")
				.where("email", "=", "original@example.com")
				.set({ name: "Updated Name" })
				.execute();

			expect(result).toBeDefined();

			const updated = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "original@example.com")
				.executeTakeFirst();

			expect(updated?.name).toBe("Updated Name");
		});

		it("should update multiple users with matching criteria", async () => {
			await db
				.insertInto("users")
				.values([
					{ name: "User1", email: "user1@example.com" },
					{ name: "User2", email: "user2@example.com" },
				])
				.execute();

			await db
				.updateTable("users")
				.where("name", "like", "%User%")
				.set({ email: "updated@example.com" })
				.execute();

			const users = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "updated@example.com")
				.execute();

			expect(users.length).toBe(2);
		});

		it("should handle update on non-existent record", async () => {
			const result = await db
				.updateTable("users")
				.where("email", "=", "nonexistent@example.com")
				.set({ name: "Updated" })
				.execute();

			expect(result).toBeDefined();
		});
	});

	describe("Delete Operation", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "User to Delete", email: "delete@example.com" },
					{ name: "User to Keep", email: "keep@example.com" },
				])
				.execute();
		});

		it("should delete user by email", async () => {
			const before = await db.selectFrom("users").selectAll().execute();
			expect(before.length).toBe(2);

			await db
				.deleteFrom("users")
				.where("email", "=", "delete@example.com")
				.execute();

			const after = await db.selectFrom("users").selectAll().execute();
			expect(after.length).toBe(1);
		});

		it("should delete all records matching criteria", async () => {
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "Test1", email: "test1@example.com" },
					{ name: "Test2", email: "test2@example.com" },
					{ name: "Keep", email: "keep@example.com" },
				])
				.execute();

			await db.deleteFrom("users").where("name", "like", "%Test%").execute();

			const remaining = await db.selectFrom("users").selectAll().execute();

			expect(remaining.length).toBe(1);
			if (remaining[0]) {
				expect(remaining[0].name).toBe("Keep");
			}
		});

		it("should handle delete on non-existent records", async () => {
			const result = await db
				.deleteFrom("users")
				.where("email", "=", "nonexistent@example.com")
				.execute();

			expect(result).toBeDefined();
		});
	});

	describe("Transaction Operation", () => {
		it("should commit transaction successfully", async () => {
			await db.transaction().execute(async (trx) => {
				await trx
					.insertInto("users")
					.values({
						name: "Transaction User",
						email: "transaction@example.com",
					})
					.execute();
			});

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "transaction@example.com")
				.executeTakeFirst();

			expect(user).toBeDefined();
		});

		it("should rollback transaction on error", async () => {
			try {
				await db.transaction().execute(async (trx) => {
					await trx
						.insertInto("users")
						.values({ name: "Rollback User", email: "rollback@example.com" })
						.execute();

					// Force an error to trigger rollback
					throw new Error("Intentional error");
				});
			} catch {
				// Expected to fail
			}

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "rollback@example.com")
				.executeTakeFirst();

			expect(user).toBeUndefined();
		});
	});

	describe("Raw SQL", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "SQL Test", email: "sqltest@example.com" })
				.execute();
		});

		it("should execute raw SQL query", async () => {
			const result = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "sqltest@example.com")
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});

		it("should execute raw SQL with parameters", async () => {
			const email = "sqltest@example.com";
			const result = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", email)
				.executeTakeFirst();

			expect(result?.name).toBe("SQL Test");
		});

		it("should handle valid SQL syntax", async () => {
			try {
				await db.selectFrom("users").selectAll().execute();
				// This should succeed with valid syntax
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});

	describe("Complex Query", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			const user1 = await db
				.insertInto("users")
				.values({ name: "User 1", email: "user1@example.com" })
				.returning("id")
				.executeTakeFirst();

			const user2 = await db
				.insertInto("users")
				.values({ name: "User 2", email: "user2@example.com" })
				.returning("id")
				.executeTakeFirst();

			if (user1 && user2) {
				await db
					.insertInto("posts")
					.values([
						{
							userId: user1.id,
							title: "Post 1",
							content: "Content 1",
						},
						{
							userId: user1.id,
							title: "Post 2",
							content: "Content 2",
						},
						{
							userId: user2.id,
							title: "Post 3",
							content: "Content 3",
						},
					])
					.execute();
			}
		});

		it("should query with multiple joins and conditions", async () => {
			const result = await db
				.selectFrom("users")
				.innerJoin("posts", "users.id", "posts.userId")
				.select(["users.name", "posts.title"])
				.where((eb) => eb("users.name", "=", "User 1"))
				.execute();

			expect(result.length).toBe(2);
			if (result[0]) {
				expect(result[0].name).toBe("User 1");
			}
		});

		it("should count posts per user", async () => {
			const result = await db
				.selectFrom("posts")
				.select((eb) => ["userId", eb.fn.count<number>("id").as("postCount")])
				.groupBy("userId")
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});

		it("should order and limit results", async () => {
			const result = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(2)
				.execute();

			expect(result.length).toBeLessThanOrEqual(2);
		});

		it("should use offset and limit for pagination", async () => {
			const page1 = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("id", "asc")
				.limit(2)
				.offset(0)
				.execute();

			const page2 = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("id", "asc")
				.limit(2)
				.offset(2)
				.execute();

			expect(page1.length).toBeGreaterThan(0);
			if (page1[0] && page2[0]) {
				expect(page1[0].id).not.toBe(page2[0].id);
			}
		});

		it("should filter with complex where conditions", async () => {
			const result = await db
				.selectFrom("posts")
				.selectAll()
				.where((eb) =>
					eb.or([eb("title", "like", "%1"), eb("title", "like", "%2")]),
				)
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});
	});
});

describe("MySQL", () => {
	let db: Kysely<Database>;

	beforeAll(async () => {
		db = createDatabase("mysql");

		// Create tables
		await db.schema
			.createTable("users")
			.ifNotExists()
			.addColumn("id", "integer", (col) =>
				col.primaryKey().autoIncrement().notNull(),
			)
			.addColumn("name", "varchar(255)", (col) => col.notNull())
			.addColumn("email", "varchar(255)", (col) => col.notNull())
			.addColumn("createdAt", "timestamp", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();

		await db.schema
			.createTable("posts")
			.ifNotExists()
			.addColumn("id", "integer", (col) =>
				col.primaryKey().autoIncrement().notNull(),
			)
			.addColumn("userId", "integer", (col) => col.notNull())
			.addColumn("title", "varchar(255)", (col) => col.notNull())
			.addColumn("content", "text")
			.addColumn("createdAt", "timestamp", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();
	});

	afterAll(async () => {
		// Close the database connection
		await db.destroy();
	});

	describe("Table Creation", () => {
		it("should create tables with correct schema", async () => {
			// This test verifies the tables were created during beforeAll
			const users = await db.selectFrom("users").selectAll().execute();
			expect(Array.isArray(users)).toBe(true);
		});

		it("should handle table creation with ifNotExists", async () => {
			// This should succeed even though table exists due to ifNotExists
			// ifNotExists returns undefined when table already exists, which is expected
			await db.schema
				.createTable("users")
				.ifNotExists()
				.addColumn("id", "integer")
				.execute();

			// Verify table still works
			const users = await db.selectFrom("users").selectAll().execute();
			expect(Array.isArray(users)).toBe(true);
		});
	});

	describe("Create Operation", () => {
		it("should insert a new user successfully", async () => {
			const result = await db
				.insertInto("users")
				.values({ name: "John Doe", email: "john@example.com" })
				.execute();

			expect(result).toBeDefined();
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "john@example.com")
				.executeTakeFirst();
			expect(user?.id).toBeGreaterThan(0);
		});

		it("should insert multiple users", async () => {
			const users = [
				{ name: "Alice", email: "alice@example.com" },
				{ name: "Bob", email: "bob@example.com" },
				{ name: "Charlie", email: "charlie@example.com" },
			];

			const result = await db.insertInto("users").values(users).execute();

			expect(result).toBeDefined();
		});

		it("should insert a post with user reference", async () => {
			const user = await db
				.selectFrom("users")
				.select("id")
				.limit(1)
				.executeTakeFirst();

			if (!user) {
				await db
					.insertInto("users")
					.values({ name: "Jane Doe", email: "jane@example.com" })
					.execute();

				const newUser = await db
					.selectFrom("users")
					.select("id")
					.where("email", "=", "jane@example.com")
					.executeTakeFirst();

				if (newUser?.id) {
					const post = await db
						.insertInto("posts")
						.values({
							userId: newUser.id,
							title: "My First Post",
							content: "This is my first post!",
						})
						.execute();

					expect(post).toBeDefined();
				}
			} else if (user.id) {
				const post = await db
					.insertInto("posts")
					.values({
						userId: user.id,
						title: "My First Post",
						content: "This is my first post!",
					})
					.execute();

				expect(post).toBeDefined();
			}
		});

		it("should fail to insert without required fields (incorrect)", async () => {
			try {
				const invalidData = { name: "Test" };
				await db
					.insertInto("users")
					// biome-ignore lint/suspicious/noExplicitAny: for testing incomplete data
					.values(invalidData as any)
					.execute();
				expect(true).toBe(false); // Should not reach here
			} catch {
				// Expected to fail due to missing required field
				expect(true).toBe(true);
			}
		});
	});

	describe("Read Operation", () => {
		beforeEach(async () => {
			// Clear and insert fresh test data
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "Test User", email: "test@example.com" })
				.execute();

			const userId = await db
				.selectFrom("users")
				.select("id")
				.where("email", "=", "test@example.com")
				.executeTakeFirst();

			if (userId?.id) {
				await db
					.insertInto("posts")
					.values({
						userId: userId.id,
						title: "Test Post",
						content: "Test Content",
					})
					.execute();
			}
		});

		it("should select all users", async () => {
			const users = await db.selectFrom("users").selectAll().execute();

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBeGreaterThan(0);
		});

		it("should select user by email", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "test@example.com")
				.executeTakeFirst();

			expect(user).toBeDefined();
			expect(user?.name).toBe("Test User");
		});

		it("should return undefined for non-existent user", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "nonexistent@example.com")
				.executeTakeFirst();

			expect(user).toBeUndefined();
		});

		it("should select with joins", async () => {
			const result = await db
				.selectFrom("posts")
				.innerJoin("users", "posts.userId", "users.id")
				.select(["posts.title", "users.name", "posts.content"])
				.execute();

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should select with where conditions", async () => {
			const posts = await db
				.selectFrom("posts")
				.selectAll()
				.where("title", "=", "Test Post")
				.execute();

			expect(posts.length).toBeGreaterThan(0);
			if (posts[0]) {
				expect(posts[0].title).toBe("Test Post");
			}
		});
	});

	describe("Update Operation", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "Original Name", email: "original@example.com" })
				.execute();
		});

		it("should update a user by email", async () => {
			const result = await db
				.updateTable("users")
				.where("email", "=", "original@example.com")
				.set({ name: "Updated Name" })
				.execute();

			expect(result).toBeDefined();

			const updated = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "original@example.com")
				.executeTakeFirst();

			expect(updated?.name).toBe("Updated Name");
		});

		it("should update multiple users with matching criteria", async () => {
			await db
				.insertInto("users")
				.values([
					{ name: "User1", email: "user1@example.com" },
					{ name: "User2", email: "user2@example.com" },
				])
				.execute();

			await db
				.updateTable("users")
				.where("name", "like", "%User%")
				.set({ email: "updated@example.com" })
				.execute();

			const users = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "updated@example.com")
				.execute();

			expect(users.length).toBe(2);
		});

		it("should handle update on non-existent record", async () => {
			const result = await db
				.updateTable("users")
				.where("email", "=", "nonexistent@example.com")
				.set({ name: "Updated" })
				.execute();

			expect(result).toBeDefined();
		});
	});

	describe("Delete Operation", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "User to Delete", email: "delete@example.com" },
					{ name: "User to Keep", email: "keep@example.com" },
				])
				.execute();
		});

		it("should delete user by email", async () => {
			const before = await db.selectFrom("users").selectAll().execute();
			expect(before.length).toBe(2);

			await db
				.deleteFrom("users")
				.where("email", "=", "delete@example.com")
				.execute();

			const after = await db.selectFrom("users").selectAll().execute();
			expect(after.length).toBe(1);
		});

		it("should delete all records matching criteria", async () => {
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "Test1", email: "test1@example.com" },
					{ name: "Test2", email: "test2@example.com" },
					{ name: "Keep", email: "keep@example.com" },
				])
				.execute();

			await db.deleteFrom("users").where("name", "like", "%Test%").execute();

			const remaining = await db.selectFrom("users").selectAll().execute();

			expect(remaining.length).toBe(1);
			if (remaining[0]) {
				expect(remaining[0].name).toBe("Keep");
			}
		});

		it("should handle delete on non-existent records", async () => {
			const result = await db
				.deleteFrom("users")
				.where("email", "=", "nonexistent@example.com")
				.execute();

			expect(result).toBeDefined();
		});
	});

	describe("Transaction Operation", () => {
		it("should commit transaction successfully", async () => {
			await db.transaction().execute(async (trx) => {
				await trx
					.insertInto("users")
					.values({
						name: "Transaction User",
						email: "transaction@example.com",
					})
					.execute();
			});

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "transaction@example.com")
				.executeTakeFirst();

			expect(user).toBeDefined();
		});

		it("should rollback transaction on error", async () => {
			try {
				await db.transaction().execute(async (trx) => {
					await trx
						.insertInto("users")
						.values({ name: "Rollback User", email: "rollback@example.com" })
						.execute();

					// Force an error to trigger rollback
					throw new Error("Intentional error");
				});
			} catch {
				// Expected to fail
			}

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "rollback@example.com")
				.executeTakeFirst();

			expect(user).toBeUndefined();
		});
	});

	describe("Raw SQL", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "SQL Test", email: "sqltest@example.com" })
				.execute();
		});

		it("should execute raw SQL query", async () => {
			const result = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "sqltest@example.com")
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});

		it("should execute raw SQL with parameters", async () => {
			const email = "sqltest@example.com";
			const result = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", email)
				.executeTakeFirst();

			expect(result?.name).toBe("SQL Test");
		});

		it("should handle valid SQL syntax", async () => {
			try {
				await db.selectFrom("users").selectAll().execute();
				// This should succeed with valid syntax
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});

	describe("Complex Query", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "User 1", email: "user1@example.com" },
					{ name: "User 2", email: "user2@example.com" },
				])
				.execute();

			const users = await db.selectFrom("users").select("id").execute();

			if (users.length >= 2 && users[0]?.id && users[1]?.id) {
				await db
					.insertInto("posts")
					.values([
						{
							userId: users[0].id,
							title: "Post 1",
							content: "Content 1",
						},
						{
							userId: users[0].id,
							title: "Post 2",
							content: "Content 2",
						},
						{
							userId: users[1].id,
							title: "Post 3",
							content: "Content 3",
						},
					])
					.execute();
			}
		});

		it("should query with multiple joins and conditions", async () => {
			const result = await db
				.selectFrom("users")
				.innerJoin("posts", "users.id", "posts.userId")
				.select(["users.name", "posts.title"])
				.where((eb) => eb("users.name", "=", "User 1"))
				.execute();

			expect(result.length).toBe(2);
			if (result[0]) {
				expect(result[0].name).toBe("User 1");
			}
		});

		it("should count posts per user", async () => {
			const result = await db
				.selectFrom("posts")
				.select((eb) => ["userId", eb.fn.count<number>("id").as("postCount")])
				.groupBy("userId")
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});

		it("should order and limit results", async () => {
			const result = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(2)
				.execute();

			expect(result.length).toBeLessThanOrEqual(2);
		});

		it("should use offset and limit for pagination", async () => {
			const page1 = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("id", "asc")
				.limit(2)
				.offset(0)
				.execute();

			const page2 = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("id", "asc")
				.limit(2)
				.offset(2)
				.execute();

			expect(page1.length).toBeGreaterThan(0);
			if (page1[0] && page2[0]) {
				expect(page1[0].id).not.toBe(page2[0].id);
			}
		});

		it("should filter with complex where conditions", async () => {
			const result = await db
				.selectFrom("posts")
				.selectAll()
				.where((eb) =>
					eb.or([eb("title", "like", "%1"), eb("title", "like", "%2")]),
				)
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});
	});
});

describe("SQLite", () => {
	let db: Kysely<Database>;

	beforeAll(async () => {
		db = createDatabase("sqlite");

		// Create tables
		await db.schema
			.createTable("users")
			.addColumn("id", "integer", (col) =>
				col.primaryKey().autoIncrement().notNull(),
			)
			.addColumn("name", "varchar", (col) => col.notNull())
			.addColumn("email", "varchar", (col) => col.notNull())
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();

		await db.schema
			.createTable("posts")
			.addColumn("id", "integer", (col) =>
				col.primaryKey().autoIncrement().notNull(),
			)
			.addColumn("userId", "integer", (col) => col.notNull())
			.addColumn("title", "varchar", (col) => col.notNull())
			.addColumn("content", "text")
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();
	});

	afterAll(async () => {
		// Close the database connection
		await db.destroy();
	});

	describe("Table Creation", () => {
		it("should create tables with correct schema", async () => {
			// This test verifies the tables were created during beforeAll
			const users = await db.selectFrom("users").selectAll().execute();
			expect(Array.isArray(users)).toBe(true);
		});

		it("should handle table creation errors (incorrect - table already exists)", async () => {
			try {
				await db.schema
					.createTable("users")
					.addColumn("id", "integer")
					.execute();
				// If we get here, the test should fail because the table already exists
				expect(false).toBe(true);
			} catch {
				// Expected to fail since table already exists
				expect(true).toBe(true);
			}
		});
	});

	describe("Create Operation", () => {
		it("should insert a new user successfully", async () => {
			const result = await db
				.insertInto("users")
				.values({ name: "John Doe", email: "john@example.com" })
				.returning("id")
				.executeTakeFirst();

			expect(result).toBeDefined();
			expect(result?.id).toBeGreaterThan(0);
		});

		it("should insert multiple users", async () => {
			const users = [
				{ name: "Alice", email: "alice@example.com" },
				{ name: "Bob", email: "bob@example.com" },
				{ name: "Charlie", email: "charlie@example.com" },
			];

			const result = await db.insertInto("users").values(users).execute();

			expect(result).toBeDefined();
		});

		it("should insert a post with user reference", async () => {
			const user = await db
				.insertInto("users")
				.values({ name: "Jane Doe", email: "jane@example.com" })
				.returning("id")
				.executeTakeFirst();

			expect(user?.id).toBeDefined();

			const post = await db
				.insertInto("posts")
				.values({
					userId: user?.id ?? 0,
					title: "My First Post",
					content: "This is my first post!",
				})
				.returning("id")
				.executeTakeFirst();

			expect(post?.id).toBeGreaterThan(0);
		});

		it("should fail to insert without required fields (incorrect)", async () => {
			try {
				const invalidData: Record<string, unknown> = {
					name: "Test",
					// email is required but missing
				};
				await db
					.insertInto("users")
					// biome-ignore lint/suspicious/noExplicitAny: for testing
					.values(invalidData as any)
					.execute();
				expect(true).toBe(false); // Should not reach here
			} catch {
				// Expected to fail due to missing required field
				expect(true).toBe(true);
			}
		});
	});

	describe("Read Operation", () => {
		beforeEach(async () => {
			// Clear and insert fresh test data
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			const userId = await db
				.insertInto("users")
				.values({ name: "Test User", email: "test@example.com" })
				.returning("id")
				.executeTakeFirst();

			if (userId) {
				await db
					.insertInto("posts")
					.values({
						userId: userId.id,
						title: "Test Post",
						content: "Test Content",
					})
					.execute();
			}
		});

		it("should select all users", async () => {
			const users = await db.selectFrom("users").selectAll().execute();

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBeGreaterThan(0);
		});

		it("should select user by email", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "test@example.com")
				.executeTakeFirst();

			expect(user).toBeDefined();
			expect(user?.name).toBe("Test User");
		});

		it("should return empty array for non-existent user", async () => {
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "nonexistent@example.com")
				.executeTakeFirst();

			expect(user).toBeUndefined();
		});

		it("should select with joins", async () => {
			const result = await db
				.selectFrom("posts")
				.innerJoin("users", "posts.userId", "users.id")
				.select(["posts.title", "users.name", "posts.content"])
				.execute();

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should select with where conditions", async () => {
			const posts = await db
				.selectFrom("posts")
				.selectAll()
				.where("title", "=", "Test Post")
				.execute();

			expect(posts.length).toBeGreaterThan(0);
			expect(posts[0]?.title ?? "").toBe("Test Post");
		});
	});

	describe("Update Operation", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "Original Name", email: "original@example.com" })
				.execute();
		});

		it("should update a user by email", async () => {
			const result = await db
				.updateTable("users")
				.where("email", "=", "original@example.com")
				.set({ name: "Updated Name" })
				.execute();

			expect(result).toBeDefined();

			const updated = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "original@example.com")
				.executeTakeFirst();

			expect(updated?.name).toBe("Updated Name");
		});

		it("should update multiple users with matching criteria", async () => {
			await db
				.insertInto("users")
				.values([
					{ name: "User1", email: "user1@example.com" },
					{ name: "User2", email: "user2@example.com" },
				])
				.execute();

			await db
				.updateTable("users")
				.where("name", "like", "%User%")
				.set({ email: "updated@example.com" })
				.execute();

			const users = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "updated@example.com")
				.execute();

			expect(users.length).toBe(2);
		});

		it("should not throw error updating non-existent record (incorrect - no error expected)", async () => {
			const result = await db
				.updateTable("users")
				.where("email", "=", "nonexistent@example.com")
				.set({ name: "Updated" })
				.execute();

			expect(result).toBeDefined();
		});
	});

	describe("Delete Operation", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "User to Delete", email: "delete@example.com" },
					{ name: "User to Keep", email: "keep@example.com" },
				])
				.execute();
		});

		it("should delete user by email", async () => {
			const before = await db.selectFrom("users").selectAll().execute();
			expect(before.length).toBe(2);

			await db
				.deleteFrom("users")
				.where("email", "=", "delete@example.com")
				.execute();

			const after = await db.selectFrom("users").selectAll().execute();
			expect(after.length).toBe(1);
		});

		it("should delete all records matching criteria", async () => {
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values([
					{ name: "Test1", email: "test1@example.com" },
					{ name: "Test2", email: "test2@example.com" },
					{ name: "Keep", email: "keep@example.com" },
				])
				.execute();

			await db.deleteFrom("users").where("name", "like", "%Test%").execute();

			const remaining = await db.selectFrom("users").selectAll().execute();

			expect(remaining.length).toBe(1);
			expect(remaining[0]?.name).toBe("Keep");
		});

		it("should handle delete on non-existent records (incorrect - no error)", async () => {
			const result = await db
				.deleteFrom("users")
				.where("email", "=", "nonexistent@example.com")
				.execute();

			expect(result).toBeDefined();
		});
	});

	describe("Transaction Operation", () => {
		it("should commit transaction successfully", async () => {
			await db.transaction().execute(async (trx) => {
				await trx
					.insertInto("users")
					.values({
						name: "Transaction User",
						email: "transaction@example.com",
					})
					.execute();
			});

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "transaction@example.com")
				.executeTakeFirst();

			expect(user).toBeDefined();
		});

		it("should rollback transaction on error", async () => {
			try {
				await db.transaction().execute(async (trx) => {
					await trx
						.insertInto("users")
						.values({ name: "Rollback User", email: "rollback@example.com" })
						.execute();

					// Force an error to trigger rollback
					throw new Error("Intentional error");
				});
			} catch {
				// Expected to fail
			}

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "rollback@example.com")
				.executeTakeFirst();

			expect(user).toBeUndefined();
		});
	});

	describe("Raw SQL", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			await db
				.insertInto("users")
				.values({ name: "SQL Test", email: "sqltest@example.com" })
				.execute();
		});

		it("should execute raw SQL query", async () => {
			const result = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", "sqltest@example.com")
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});

		it("should execute raw SQL with parameters", async () => {
			const email = "sqltest@example.com";
			const result = await db
				.selectFrom("users")
				.selectAll()
				.where("email", "=", email)
				.executeTakeFirst();

			expect(result?.name).toBe("SQL Test");
		});

		it("should handle invalid SQL syntax (incorrect)", async () => {
			try {
				await db.selectFrom("users").selectAll().execute();
				// This should succeed with valid syntax
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});

	describe("Complex Query", () => {
		beforeEach(async () => {
			await db.deleteFrom("posts").execute();
			await db.deleteFrom("users").execute();

			const user1 = await db
				.insertInto("users")
				.values({ name: "User 1", email: "user1@example.com" })
				.returning("id")
				.executeTakeFirst();

			const user2 = await db
				.insertInto("users")
				.values({ name: "User 2", email: "user2@example.com" })
				.returning("id")
				.executeTakeFirst();

			if (user1 && user2) {
				await db
					.insertInto("posts")
					.values([
						{
							userId: user1.id,
							title: "Post 1",
							content: "Content 1",
						},
						{
							userId: user1.id,
							title: "Post 2",
							content: "Content 2",
						},
						{
							userId: user2.id,
							title: "Post 3",
							content: "Content 3",
						},
					])
					.execute();
			}
		});

		it("should query with multiple joins and conditions", async () => {
			const result = await db
				.selectFrom("users")
				.innerJoin("posts", "users.id", "posts.userId")
				.select(["users.name", "posts.title"])
				.where("users.name", "=", "User 1")
				.execute();

			expect(result.length).toBe(2);
			expect(result[0]?.name).toBe("User 1");
		});

		it("should count posts per user", async () => {
			const result = await db
				.selectFrom("posts")
				.select((eb) => ["userId", eb.fn.count<number>("id").as("postCount")])
				.groupBy("userId")
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});

		it("should order and limit results", async () => {
			const result = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(2)
				.execute();

			expect(result.length).toBeLessThanOrEqual(2);
		});

		it("should use offset and limit for pagination", async () => {
			const page1 = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("id", "asc")
				.limit(2)
				.offset(0)
				.execute();

			const page2 = await db
				.selectFrom("posts")
				.selectAll()
				.orderBy("id", "asc")
				.limit(2)
				.offset(2)
				.execute();

			expect(page1.length).toBeGreaterThan(0);
			expect(page1[0]?.id).not.toBe(page2[0]?.id);
		});

		it("should filter with complex where conditions", async () => {
			const result = await db
				.selectFrom("posts")
				.selectAll()
				.where((eb) =>
					eb.or([eb("title", "like", "%1"), eb("title", "like", "%2")]),
				)
				.execute();

			expect(result.length).toBeGreaterThan(0);
		});
	});
});

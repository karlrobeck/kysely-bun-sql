import { BunSQLDialect } from "@karlrobeck/kysely-bun-sql";
import type { Insertable } from "kysely";
import { Kysely, sql } from "kysely";
import { SQL } from "bun";

// Define your database schema
interface UsersTable {
	id: number;
	name: string;
	email: string;
	created_at: string;
}

interface PostsTable {
	id: number;
	user_id: number;
	title: string;
	content: string;
	created_at: string;
}

interface Database {
	users: UsersTable;
	posts: PostsTable;
}

async function main() {
	// Initialize the database connection using PostgreSQL
	const db = new Kysely<Database>({
		dialect: new BunSQLDialect({
			database: new SQL("postgres://admin:password@localhost:5432/test_db"),
		}),
	});

	try {
		// Drop existing tables if they exist
		await db.schema.dropTable("posts").ifExists().execute();
		await db.schema.dropTable("users").ifExists().execute();

		// Create users table
		await db.schema
			.createTable("users")
			.addColumn("id", "serial", (col) => col.primaryKey())
			.addColumn("name", "varchar", (col) => col.notNull())
			.addColumn("email", "varchar", (col) => col.notNull().unique())
			.addColumn("created_at", "timestamp", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
			)
			.execute();

		// Create posts table
		await db.schema
			.createTable("posts")
			.addColumn("id", "serial", (col) => col.primaryKey())
			.addColumn("user_id", "integer", (col) =>
				col.notNull().references("users.id").onDelete("cascade")
			)
			.addColumn("title", "varchar", (col) => col.notNull())
			.addColumn("content", "text", (col) => col.notNull())
			.addColumn("created_at", "timestamp", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
			)
			.execute();

		console.log("✓ Tables created successfully");

		// Insert sample data
		const user = await db
			.insertInto("users")
			.values({
				name: "Alice Smith",
				email: "alice@example.com",
			} as any)
			.returningAll()
			.executeTakeFirstOrThrow();

		console.log("✓ User inserted:", user);

		// Insert posts
		await db
			.insertInto("posts")
			.values([
				{
					user_id: user.id,
					title: "PostgreSQL is Awesome",
					content: "PostgreSQL provides powerful features for SQL queries.",
				},
				{
					user_id: user.id,
					title: "Advanced Queries",
					content: "Learn about window functions and CTEs in PostgreSQL.",
				},
			] as any)
			.execute();

		console.log("✓ Posts inserted");

		// Query all users
		const users = await db.selectFrom("users").selectAll().execute();

		console.log("✓ All users:", users);

		// Query with join and filtering
		const userPosts = await db
			.selectFrom("posts")
			.innerJoin("users", "posts.user_id", "users.id")
			.select([
				"posts.id",
				"posts.title",
				"posts.content",
				"users.name",
				"users.email",
			])
			.where("users.id", "=", user.id)
			.orderBy("posts.created_at", "desc")
			.execute();

		console.log("✓ User posts:", userPosts);

		// Update example
		await db
			.updateTable("users")
			.set({ name: "Alice Johnson" })
			.where("id", "=", user.id)
			.execute();

		console.log("✓ User updated");

		// Count posts
		const postCount = await db
			.selectFrom("posts")
			.select((eb) => eb.fn.count<number>("id").as("count"))
			.executeTakeFirstOrThrow();

		console.log("✓ Total posts:", postCount.count);

		// Delete example
		await db.deleteFrom("posts").where("id", "=", 1).execute();

		console.log("✓ Post deleted");
	} catch (error) {
		console.error("Error:", error);
	} finally {
		// Cleanup
		await db.destroy();
		process.exit(0);
	}
}

await main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});


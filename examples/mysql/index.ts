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
	// Initialize the database connection using MySQL
	const db = new Kysely<Database>({
		dialect: new BunSQLDialect({
			database: new SQL("mysql://admin:password@localhost:3306/test_db"),
		}),
	});

	try {
		// Drop existing tables if they exist
		await db.schema.dropTable("posts").ifExists().execute();
		await db.schema.dropTable("users").ifExists().execute();

		// Create users table
		await db.schema
			.createTable("users")
			.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
			.addColumn("name", "varchar(255)", (col) => col.notNull())
			.addColumn("email", "varchar(255)", (col) => col.notNull().unique())
			.addColumn("created_at", "datetime", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
			)
			.execute();

		// Create posts table
		await db.schema
			.createTable("posts")
			.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
			.addColumn("user_id", "integer", (col) =>
				col.notNull().references("users.id").onDelete("cascade"),
			)
			.addColumn("title", "varchar(255)", (col) => col.notNull())
			.addColumn("content", "text", (col) => col.notNull())
			.addColumn("created_at", "datetime", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
			)
			.execute();

		console.log("✓ Tables created successfully");

		// Insert sample data
		await db
			.insertInto("users")
			.values({
				name: "Bob Wilson",
				email: "bob@example.com",
			} as any)
			.execute();

		const user = await db
			.selectFrom("users")
			.selectAll()
			.orderBy("id", "desc")
			.limit(1)
			.executeTakeFirstOrThrow();

		const userId = user.id;
		console.log("✓ User inserted with ID:", userId);

		// Insert posts
		await db
			.insertInto("posts")
			.values([
				{
					user_id: userId as number,
					title: "Getting Started with MySQL",
					content:
						"Learn how to use MySQL with Bun and Kysely for type-safe queries.",
				},
				{
					user_id: userId as number,
					title: "Best Practices",
					content:
						"Follow these best practices when building MySQL applications.",
				},
			] as any)
			.execute();

		console.log("✓ Posts inserted");

		// Query all users
		const users = await db.selectFrom("users").selectAll().execute();

		console.log("✓ All users:", users);

		// Query with join
		const posts = await db
			.selectFrom("posts")
			.innerJoin("users", "posts.user_id", "users.id")
			.select([
				"posts.id",
				"posts.title",
				"posts.content",
				"users.name",
				"users.email",
			])
			.execute();

		console.log("✓ All posts with authors:", posts);

		// Complex query with aggregation
		const userStats = await db
			.selectFrom("users")
			.leftJoin("posts", "users.id", "posts.user_id")
			.select((eb) => [
				"users.id",
				"users.name",
				"users.email",
				eb.fn.count<number>("posts.id").as("post_count"),
			])
			.groupBy("users.id")
			.execute();

		console.log("✓ User statistics:", userStats);

		// Update example
		await db
			.updateTable("users")
			.set({ name: "Bob Johnson" })
			.where("id", "=", userId as number)
			.execute();

		console.log("✓ User updated");

		// Query with WHERE clause
		const userPosts = await db
			.selectFrom("posts")
			.selectAll()
			.where("user_id", "=", userId as number)
			.orderBy("created_at", "desc")
			.execute();

		console.log("✓ User's posts:", userPosts);

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


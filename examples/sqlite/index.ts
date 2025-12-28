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
	// Initialize the database connection using SQLite
	const db = new Kysely<Database>({
		dialect: new BunSQLDialect({
			database: new SQL({
				filename: ":memory:",
			}),
		}),
	});

	// Create users table
	await db.schema
		.createTable("users")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("email", "text", (col) => col.notNull().unique())
		.addColumn("created_at", "datetime", (col) =>
			col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.execute();

	// Create posts table
	await db.schema
		.createTable("posts")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("user_id", "integer", (col) =>
			col.notNull().references("users.id"),
		)
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("created_at", "datetime", (col) =>
			col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.execute();

	console.log("✓ Tables created successfully");

	// Insert sample data
	await db
		.insertInto("users")
		.values({
			name: "John Doe",
			email: "john@example.com",
		} as any)
		.execute();

	const user = await db
		.selectFrom("users")
		.selectAll()
		.orderBy("id", "desc")
		.limit(1)
		.executeTakeFirstOrThrow();

	console.log("✓ User inserted:", user);

	// Insert posts
	await db
		.insertInto("posts")
		.values([
			{
				user_id: user.id,
				title: "First Post",
				content: "This is my first post!",
			},
			{
				user_id: user.id,
				title: "Second Post",
				content: "This is my second post!",
			},
		] as any)
		.execute();

	console.log("✓ Posts inserted");

	// Query all users with their posts
	const users = await db.selectFrom("users").selectAll().execute();

	console.log("✓ Users:", users);

	// Query with join
	const postsWithUsers = await db
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

	console.log("✓ Posts with users:", postsWithUsers);

	// Update example
	await db
		.updateTable("users")
		.set({ name: "Jane Doe" })
		.where("id", "=", user.id)
		.execute();

	console.log("✓ User updated");

	// Delete example
	await db.deleteFrom("posts").where("id", "=", 1).execute();

	console.log("✓ Post deleted");

	// Cleanup
	await db.destroy();
}

await main().catch(console.error);

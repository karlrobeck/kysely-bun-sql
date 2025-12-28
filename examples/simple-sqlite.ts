import { SQL } from "bun";
import { Kysely, sql } from "kysely";
import type { Database } from "./db";
import { BunSQLDialect } from "../src";

const database = new SQL(":memory:");

const kysely = new Kysely<Database>({
	dialect: new BunSQLDialect({ database }),
});

console.log("🚀 Testing Bun SQL Driver\n");

// ============ CREATE TABLE ============
console.log("📋 Creating table...");
await kysely.schema
	.createTable("todo")
	.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
	.addColumn("title", "text", (col) => col.notNull())
	.addColumn("description", "text")
	.execute();

const tables = await kysely.introspection.getTables();
console.log("✅ Table created successfully");
console.log(
	"Tables in database:",
	tables.map((t) => t.name),
);

// ============ CREATE (INSERT) ============
console.log("\n📝 Inserting todos...");
const insertedIds = await kysely
	.insertInto("todo")
	.values([
		{ title: "Learn Kysely", description: "Understand Kysely ORM" },
		{ title: "Learn Bun SQL", description: "Master Bun SQL driver" },
		{ title: "Build an app", description: "Create a real-world application" },
	])
	.returning("id")
	.execute();

console.log(
	"✅ Inserted todos with IDs:",
	insertedIds.map((r) => r.id),
);

// ============ READ (SELECT) ============
console.log("\n📖 Reading all todos...");
const allTodos = await kysely.selectFrom("todo").selectAll().execute();
console.log("✅ All todos:");
console.table(allTodos);

console.log("\n📖 Reading single todo by ID...");
const singleTodo = await kysely
	.selectFrom("todo")
	.selectAll()
	.where("id", "=", 1)
	.executeTakeFirst();
console.log("✅ Single todo:", singleTodo);

// ============ UPDATE ============
console.log("\n✏️ Updating todo...");
const updatedTodo = await kysely
	.updateTable("todo")
	.set({ description: "Updated description for Kysely" })
	.where("id", "=", 1)
	.returning(["id", "title", "description"])
	.executeTakeFirst();
console.log("✅ Updated todo:", updatedTodo);

// ============ DELETE ============
console.log("\n🗑️ Deleting a todo...");
const deletedCount = await kysely
	.deleteFrom("todo")
	.where("id", "=", 3)
	.executeTakeFirst();
console.log("✅ Deleted todo (affected rows):", deletedCount);

// ============ READ AFTER DELETE ============
console.log("\n📖 Reading remaining todos after delete...");
const remainingTodos = await kysely.selectFrom("todo").selectAll().execute();
console.log("✅ Remaining todos:");
console.table(remainingTodos);

console.log("\n🎉 All CRUD operations completed successfully!");

// ============ TRANSACTIONS ============
console.log("\n\n🔄 Testing Transactions...\n");

// Test successful transaction
console.log("✅ Transaction 1: Successful transaction");
await kysely.transaction().execute(async (trx) => {
	const newTodo = await trx
		.insertInto("todo")
		.values({
			title: "Transaction test",
			description: "This should be committed",
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await trx
		.updateTable("todo")
		.set({ description: "Updated within transaction" })
		.where("id", "=", newTodo.id)
		.execute();

	console.log(`  - Inserted and updated todo ID: ${newTodo.id}`);
});

const transactionTodos = await kysely.selectFrom("todo").selectAll().execute();
console.log(`  - Total todos after commit: ${transactionTodos.length}`);
console.table(transactionTodos);

// Test failed transaction (rollback)
console.log("\n❌ Transaction 2: Failed transaction (should rollback)");
const countBeforeRollback = await kysely
	.selectFrom("todo")
	.select((eb) => eb.fn.count<number>("id").as("count"))
	.executeTakeFirstOrThrow();

try {
	await kysely.transaction().execute(async (trx) => {
		await trx
			.insertInto("todo")
			.values({
				title: "Should rollback",
				description: "This should be rolled back",
			})
			.execute();

		console.log("  - Inserted todo that will be rolled back");

		// Intentionally throw an error to trigger rollback
		throw new Error("Simulated error to trigger rollback");
	});
} catch (error) {
	console.log(`  - Transaction rolled back: ${(error as Error).message}`);
}

const countAfterRollback = await kysely
	.selectFrom("todo")
	.select((eb) => eb.fn.count<number>("id").as("count"))
	.executeTakeFirstOrThrow();

console.log(`  - Todo count before rollback: ${countBeforeRollback.count}`);
console.log(`  - Todo count after rollback: ${countAfterRollback.count}`);
console.log(
	`  - Rollback successful: ${countBeforeRollback.count === countAfterRollback.count}`,
);

console.log("\n🎉 All transaction tests completed successfully!");

// ============ RAW SQL ============
console.log("\n\n🔧 Testing Raw SQL...\n");

// Test raw SELECT query with COUNT
console.log("✅ Raw SQL: SELECT with COUNT");
const countResult = await sql`SELECT COUNT(*) as count FROM todo`.execute(
	kysely,
);
interface CountResult {
	count: number;
}
const countRow = countResult.rows[0] as unknown as CountResult;
console.log(`  - Total todos from raw COUNT: ${countRow.count}`);

// Test raw INSERT
console.log("\n✅ Raw SQL: INSERT with raw SQL");
const rawInsertResult = await sql`
	INSERT INTO todo (title, description) 
	VALUES ('Raw SQL Todo', 'Inserted using raw SQL')
	RETURNING id
`.execute(kysely);
interface InsertResult {
	id: number;
}
const insertRow = rawInsertResult.rows[0] as unknown as InsertResult;
const insertedId = insertRow.id;
console.log(`  - Inserted raw SQL todo with ID: ${insertedId}`);

// Test raw WHERE clause
console.log("\n✅ Raw SQL: SELECT with WHERE clause");
const rawWhereResults = await sql`SELECT * FROM todo WHERE id > ${2}`.execute(
	kysely,
);
console.log(`  - Found ${rawWhereResults.rows.length} todos with ID > 2:`);
console.table(rawWhereResults.rows);

// Test raw UPDATE
console.log("\n✅ Raw SQL: UPDATE with raw SQL");
await sql`
	UPDATE todo 
	SET description = 'Updated via raw SQL' 
	WHERE id = ${insertedId}
`.execute(kysely);

const updatedRawTodo = await kysely
	.selectFrom("todo")
	.selectAll()
	.where("id", "=", insertedId)
	.executeTakeFirst();
console.log("  - Updated todo:", updatedRawTodo);

// Test raw DELETE
console.log("\n✅ Raw SQL: DELETE with raw SQL");
await sql`DELETE FROM todo WHERE title = 'Raw SQL Todo'`.execute(kysely);

const finalTodos = await kysely.selectFrom("todo").selectAll().execute();
console.log(`  - Final todos count after delete: ${finalTodos.length}`);
console.table(finalTodos);

console.log("\n🎉 All raw SQL tests completed successfully!");

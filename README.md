# kysely-bun-sql

A Kysely dialect driver for Bun's native SQL runtime, providing support for PostgreSQL, MySQL, and SQLite databases.

## Features

- **Native Bun SQL Runtime**: Uses Bun's built-in SQL client instead of Node.js database drivers
- **Multi-Database Support**: PostgreSQL, MySQL, and SQLite through a unified API
- **Automatic Detection**: Database type is automatically detected based on connection string
- **Connection Pooling**: Built-in connection pooling managed by Bun
- **Transactions**: Full transaction support with `begin`, `commit`, and `rollback`
- **Type-Safe Queries**: Full TypeScript support with Kysely's type system

## Installation

```bash
bun add kysely kysely-bun-sql
```

## Quick Start

### PostgreSQL Example

```typescript
import { Kysely, sql } from "kysely";
import { BunSQLDialect } from "kysely-bun-sql";
import { SQL } from "bun";

interface Database {
  users: {
    id: number;
    name: string;
    email: string;
  };
  posts: {
    id: number;
    userId: number;
    title: string;
    content: string;
  };
}

// Create database connection
const database = new SQL("postgres://user:password@localhost:5432/mydb");

// Initialize Kysely
const db = new Kysely<Database>({
  dialect: new BunSQLDialect({ database }),
});

// Query
const users = await db.selectFrom("users").selectAll().execute();

// Insert
const newUser = await db
  .insertInto("users")
  .values({ name: "John", email: "john@example.com" })
  .returningAll()
  .executeTakeFirst();

// Update
await db.updateTable("users").set({ name: "Jane" }).where("id", "=", 1).execute();

// Delete
await db.deleteFrom("users").where("id", "=", 1).execute();

// Transactions
await db.transaction().execute(async (trx) => {
  await trx.insertInto("posts").values({ userId: 1, title: "Hello", content: "World" }).execute();
  await trx.updateTable("users").set({ name: "Updated" }).where("id", "=", 1).execute();
});
```

### MySQL Example

```typescript
const database = new SQL("mysql://user:password@localhost:3306/mydb");

const db = new Kysely<Database>({
  dialect: new BunSQLDialect({ database }),
});
```

### SQLite Example

```typescript
// File-based
const database = new SQL("sqlite://./app.db");

// Or in-memory
const database = new SQL(":memory:");

const db = new Kysely<Database>({
  dialect: new BunSQLDialect({ database }),
});
```

## Configuration

The `BunSQLDialect` accepts a configuration object with the following options:

```typescript
interface BunSQLOptions {
  /**
   * A pre-configured Bun SQL instance
   * 
   * Database type is automatically detected from the connection string:
   * - `postgres://` or `postgresql://` → PostgreSQL
   * - `mysql://` or `mysql2://` → MySQL
   * - `:memory:`, `sqlite://`, `file://` → SQLite
   */
  database: SQL;
}
```

## Connection Strings

### PostgreSQL

```typescript
// Standard connection string
new SQL("postgres://user:password@localhost:5432/mydb");

// Alternative URLs
new SQL("postgresql://user:password@localhost:5432/mydb");

// With environment variables (DATABASE_URL, POSTGRES_URL, etc.)
new SQL(); // Uses DATABASE_URL
```

### MySQL

```typescript
// Standard connection string
new SQL("mysql://user:password@localhost:3306/mydb");

// MySQL 2 protocol
new SQL("mysql2://user:password@localhost:3306/mydb");

// With options
new SQL({
  adapter: "mysql",
  hostname: "localhost",
  port: 3306,
  database: "mydb",
  username: "user",
  password: "password",
});
```

### SQLite

```typescript
// File-based
new SQL("sqlite://./app.db");
new SQL("file://./app.db");

// In-memory
new SQL(":memory:");
new SQL("sqlite://:memory:");

// With options
new SQL({
  adapter: "sqlite",
  filename: "./app.db",
});
```

## API

### BunSQLDialect

The main dialect class that implements Kysely's `Dialect` interface.

```typescript
export class BunSQLDialect implements Dialect {
  createDriver(): Driver;
  createQueryCompiler(): QueryCompiler;
  createAdapter(): DialectAdapter;
  createIntrospector(db: Kysely<any>): DatabaseIntrospector;
}
```

### Database Operations

All standard Kysely operations are supported:

- **Select**: `db.selectFrom(table).select(...).where(...).execute()`
- **Insert**: `db.insertInto(table).values(...).returningAll().execute()`
- **Update**: `db.updateTable(table).set(...).where(...).execute()`
- **Delete**: `db.deleteFrom(table).where(...).execute()`
- **Transactions**: `db.transaction().execute(async (trx) => {...})`

## Limitations

- **Streaming Queries**: The `streamQuery` method is not yet fully supported by Bun's SQL API. Queries are executed and all results are returned at once.
- **Introspection**: Uses PostgreSQL's introspection system. For MySQL and SQLite, introspection features may be limited.
- **Advanced Features**: Some database-specific features (like PostgreSQL's `LISTEN`/`NOTIFY`) are not available through Bun's SQL API.

## Supported Query Types

- ✅ SELECT
- ✅ INSERT (with RETURNING for PostgreSQL)
- ✅ UPDATE
- ✅ DELETE
- ✅ Basic transactions
- ✅ Parameters and parameterized queries
- ✅ Connection pooling
- ❌ Streaming results
- ❌ Complex joins with raw SQL in some cases

## Type Safety

Full TypeScript support with Kysely's compile-time type checking:

```typescript
// This will error at compile-time if 'unknown_column' doesn't exist
const result = await db
  .selectFrom("users")
  .select("unknown_column") // ❌ Type error
  .execute();

// Proper usage
const result = await db
  .selectFrom("users")
  .select(["id", "name", "email"])
  .execute();
// result type: { id: number; name: string; email: string }[]
```

## Examples

### Create Table

```typescript
await db.schema
  .createTable("users")
  .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
  .addColumn("name", "varchar(255)", (col) => col.notNull())
  .addColumn("email", "varchar(255)", (col) => col.unique())
  .execute();
```

### Complex Query with Joins

```typescript
const result = await db
  .selectFrom("users")
  .innerJoin("posts", "users.id", "=", "posts.userId")
  .select(["users.id", "users.name", "posts.title"])
  .where("users.id", "=", 1)
  .execute();
```

### Aggregation

```typescript
const result = await db
  .selectFrom("posts")
  .select((eb) => [eb.fn.count<number>("id").as("post_count")])
  .groupBy("userId")
  .execute();
```

## Development

```bash
# Install dependencies
bun install

# Run type checking
bunx tsc --noEmit

# Format code
bunx biome format --write src/

# Lint code
bunx biome lint --fix src/
```

## References

- [Bun SQL Documentation](https://bun.com/docs/runtime/sql.md)
- [Kysely Documentation](https://kysely.dev)
- [PostgreSQL Driver Example](https://github.com/kysely-org/kysely/blob/main/src/dialect/postgres/postgres-driver.ts)

## License

MIT

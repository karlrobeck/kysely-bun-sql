# kysely-bun-sql

A Kysely dialect driver for Bun's native SQL runtime, providing type-safe database access for PostgreSQL, MySQL, and SQLite databases.

## What is this package?

`kysely-bun-sql` is a Kysely dialect that integrates with Bun's native SQL runtime. It allows you to use Kysely's powerful type-safe query builder with Bun's built-in database support, eliminating the need for external Node.js database drivers. This package automatically detects your database type from the connection string and provides a unified API across PostgreSQL, MySQL, and SQLite.

## Features

- **Native Bun SQL Runtime**: Uses Bun's built-in SQL client instead of external Node.js database drivers
- **Multi-Database Support**: PostgreSQL, MySQL, and SQLite through a unified API
- **Automatic Detection**: Database type is automatically detected based on connection string
- **Connection Pooling**: Built-in connection pooling managed by Bun
- **Transactions**: Full transaction support with isolation levels and access modes
- **Type-Safe Queries**: Full TypeScript support with Kysely's type system
- **CRUD Operations**: Complete support for Create, Read, Update, and Delete operations
- **Schema Operations**: Full schema manipulation support (create/drop tables, columns, etc.)
- **Introspection**: Database introspection capabilities to discover tables and schema information

## Installation

```bash
bun install https://github.com/karlrobeck/kysely-bun-sql
bun add kysely
```

## Quick Start

### PostgreSQL Example

```typescript
import { Kysely } from "kysely";
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

- **Streaming Queries**: Bun's SQL API does not support streaming. All query results are fetched and returned at once, which may have memory implications for very large result sets.
  
- **Database-Specific Features**: The following database-specific features are not available through Bun's SQL API:
  - PostgreSQL: `LISTEN`/`NOTIFY`, cursors, arrays, JSON operators
  - MySQL: full-text search (FTS)
  - SQLite: Some extension functions and advanced features
  
- **Introspection Limitations**: 
  - Database introspection uses standard SQL information schema queries
  - For best results, use with PostgreSQL (primary test target)
  - MySQL and SQLite introspection may have limitations due to schema access differences
  
- **Dynamic SQL**: Queries with dynamic SQL require using Bun's `unsafe()` method, which must be used with caution when working with user input
  
- **Connection Management**: Connection pooling and pool configuration are entirely managed by Bun and cannot be customized through the dialect options
  
- **Runtime Requirements**: Requires Bun runtime - cannot be used with Node.js

## Supported Query Types

**Legend:**
- ✅ = Tested and verified
- ❌ = Not supported
- ❓ = Not tested

- ✅ SELECT
- ✅ INSERT (with RETURNING for PostgreSQL and MySQL)
- ✅ UPDATE
- ✅ DELETE
- ✅ Basic transactions (BEGIN/COMMIT/ROLLBACK)
- ✅ Transaction isolation levels
- ✅ Parameters and parameterized queries
- ✅ Connection pooling (managed by Bun)
- ✅ Schema operations (CREATE/DROP TABLE, columns, indexes)
- ✅ Database introspection (getTables, getColumns, etc.)
- ✅ Complex joins with raw SQL in some cases
- ❌ Streaming results
- ❌ Cursors
- ❓ Database-specific advanced features

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

- [Bun SQL Documentation](https://bun.com/docs/runtime/sql)
- [Kysely Documentation](https://kysely.dev)
- [PostgreSQL Driver Example](https://github.com/kysely-org/kysely/blob/master/src/dialect/postgres/postgres-driver.ts)

## License

MIT

/**
 * D1 query layer utilities.
 * Provides helpers for parameterized queries, batch transactions, and consistent access.
 */

/** Execute a query and return all rows. */
export async function queryAll<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results;
}

/** Execute a query and return the first row, or null. */
export async function queryFirst<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null;
}

/** Execute a mutation (INSERT/UPDATE/DELETE) and return result metadata. */
export async function run(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  return await db.prepare(sql).bind(...params).run();
}

/** Build a prepared statement with bound parameters. */
export function stmt(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): D1PreparedStatement {
  return db.prepare(sql).bind(...params);
}

/**
 * Execute multiple statements atomically via D1 batch.
 * All statements run within an implicit transaction.
 */
export async function batch(
  db: D1Database,
  stmts: D1PreparedStatement[]
): Promise<D1Result[]> {
  return await db.batch(stmts);
}

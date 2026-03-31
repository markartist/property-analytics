import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

class SqlitePreparedStatement {
  private readonly boundParams: unknown[];

  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    params: unknown[] = []
  ) {
    this.boundParams = params;
  }

  bind(...params: unknown[]): SqlitePreparedStatement {
    return new SqlitePreparedStatement(this.db, this.sql, params);
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const result = stmt.run(...this.boundParams);
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    } as D1Result<T>;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...this.boundParams) as T[];
    return { results };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const result = stmt.get(...this.boundParams) as T | undefined;
    return result ?? null;
  }
}

export class SqliteD1Database {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string): D1PreparedStatement {
    return new SqlitePreparedStatement(this.db, sql) as unknown as D1PreparedStatement;
  }

  async batch(stmts: D1PreparedStatement[]): Promise<D1Result[]> {
    this.db.exec("BEGIN");
    try {
      const results: D1Result[] = [];
      for (const stmt of stmts as unknown as SqlitePreparedStatement[]) {
        results.push(await stmt.run());
      }
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

export async function createTestD1Database(): Promise<{
  db: D1Database;
  close: () => void;
}> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase1-platform-"));
  const tempPath = path.join(tempDir, "test.sqlite");
  const sqlite = new DatabaseSync(tempPath);
  const migrationSql = fs.readFileSync(
    "/Users/mark/Property_Analytics/apps/api/migrations/0021_create_phase1_platform_tables.sql",
    "utf8"
  );
  sqlite.exec(migrationSql);
  const wrapped = new SqliteD1Database(sqlite);
  return {
    db: wrapped as unknown as D1Database,
    close: () => {
      wrapped.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

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
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      external_key TEXT,
      region TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT,
      deleted_at TEXT,
      deleted_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      request_id TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      redeemed_at TEXT,
      redeemed_user_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );
  `);
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationSql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFile), "utf8");
    sqlite.exec(migrationSql);
  }
  const wrapped = new SqliteD1Database(sqlite);
  return {
    db: wrapped as unknown as D1Database,
    close: () => {
      wrapped.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

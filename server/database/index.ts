import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function useDb() {
  if (!_db) {
    const dbPath = process.env.DATABASE_URL || "sqlite.db";
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export { schema };

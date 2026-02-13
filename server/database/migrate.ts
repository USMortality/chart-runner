import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { useDb } from "./index";

export function runMigrations() {
  const db = useDb();
  migrate(db, {
    migrationsFolder: "./server/database/migrations",
  });
  console.log("[db] Migrations applied");
}

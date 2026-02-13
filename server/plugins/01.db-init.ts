import { or, eq, desc, notInArray } from "drizzle-orm";
import { runMigrations } from "../database/migrate";
import { useDb, schema } from "../database";

export default defineNitroPlugin(async () => {
  console.log("[plugin] Initializing database...");
  runMigrations();
  await runAuthMigrations();
  await seedAdmin();

  const db = useDb();

  // Clean up stale jobs from previous runs
  const stale = db
    .update(schema.jobRuns)
    .set({
      status: "failed",
      finishedAt: new Date().toISOString(),
      errorLog: "App restarted while job was in progress",
    })
    .where(
      or(
        eq(schema.jobRuns.status, "running"),
        eq(schema.jobRuns.status, "pending")
      )
    )
    .run();

  if (stale.changes > 0) {
    console.log(`[plugin] Marked ${stale.changes} stale jobs as failed`);
  }

  // Purge old runs — keep only the latest run per gist
  const gists = db.select({ id: schema.gists.id }).from(schema.gists).all();
  const keepIds: number[] = [];
  for (const gist of gists) {
    const latest = db
      .select({ id: schema.jobRuns.id })
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.gistId, gist.id))
      .orderBy(desc(schema.jobRuns.createdAt))
      .limit(1)
      .get();
    if (latest) keepIds.push(latest.id);
  }

  if (keepIds.length > 0) {
    const purged = db
      .delete(schema.jobRuns)
      .where(notInArray(schema.jobRuns.id, keepIds))
      .run();
    if (purged.changes > 0) {
      console.log(`[plugin] Purged ${purged.changes} old job runs`);
    }
  }
});

import { Cron } from "croner";
import { eq } from "drizzle-orm";
import { useDb, schema } from "../database";
import { syncGists } from "../services/gist-sync";
import { createJobRun, runJob } from "../services/job-runner";

export default defineNitroPlugin(() => {
  const schedule = process.env.CRON_SCHEDULE || "0 0 * * 0"; // Default: Sunday midnight

  try {
    new Cron(schedule, async () => {
      console.log("[scheduler] Starting scheduled run...");

      try {
        // Sync gists first
        await syncGists();
        console.log("[scheduler] Gists synced");

        // Run all active gists sequentially
        const db = useDb();
        const activeGists = db
          .select()
          .from(schema.gists)
          .where(eq(schema.gists.active, true))
          .all();

        for (const gist of activeGists) {
          const jobId = createJobRun(gist.id, "scheduled");
          try {
            await runJob(jobId, gist.id, "scheduled");
          } catch (err) {
            console.error(`[scheduler] Job ${jobId} error:`, err);
          }
        }

        console.log("[scheduler] Scheduled run complete");
      } catch (err) {
        console.error("[scheduler] Scheduled run failed:", err);
      }
    });

    console.log(`[scheduler] Cron scheduled: ${schedule}`);
  } catch (err) {
    console.error(`[scheduler] Invalid cron schedule: ${schedule}`, err);
  }
});

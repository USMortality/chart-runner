import { eq } from "drizzle-orm";
import { useDb, schema } from "../../../database";
import { createJobRun, runJob } from "../../../services/job-runner";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const db = useDb();
  const activeGists = db
    .select()
    .from(schema.gists)
    .where(eq(schema.gists.active, true))
    .all();

  if (activeGists.length === 0) {
    return { message: "No active gists", jobIds: [] };
  }

  // Create all job records first
  const jobIds = activeGists.map((gist) => ({
    gistId: gist.id,
    jobId: createJobRun(gist.id, "manual"),
  }));

  // Run sequentially in background (fire-and-forget)
  (async () => {
    for (const { gistId, jobId } of jobIds) {
      try {
        await runJob(jobId, gistId, "manual");
      } catch (err) {
        console.error(`[api] Job ${jobId} error:`, err);
      }
    }
  })();

  return { message: `Started ${jobIds.length} jobs`, jobIds: jobIds.map((j) => j.jobId) };
});

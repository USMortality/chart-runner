import { eq, desc } from "drizzle-orm";
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

  // Find gists whose latest run is "failed"
  const failedGists = activeGists.filter((gist) => {
    const latestRun = db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.gistId, gist.id))
      .orderBy(desc(schema.jobRuns.createdAt))
      .limit(1)
      .get();
    return latestRun?.status === "failed";
  });

  if (failedGists.length === 0) {
    return { message: "No failed gists to rerun", jobIds: [] };
  }

  const jobIds = failedGists.map((gist) => ({
    gistId: gist.id,
    jobId: createJobRun(gist.id, "manual"),
  }));

  // Run sequentially in background
  (async () => {
    for (const { gistId, jobId } of jobIds) {
      try {
        await runJob(jobId, gistId, "manual");
      } catch (err) {
        console.error(`[api] Rerun job ${jobId} error:`, err);
      }
    }
  })();

  return {
    message: `Rerunning ${jobIds.length} failed gists`,
    jobIds: jobIds.map((j) => j.jobId),
  };
});

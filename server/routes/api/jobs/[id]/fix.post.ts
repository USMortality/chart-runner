import { eq } from "drizzle-orm";
import { useDb, schema } from "../../../../database";
import { fixScript } from "../../../../services/claude-fix";
import { createJobRun, runFixedJob } from "../../../../services/job-runner";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = parseInt(getRouterParam(event, "id") || "", 10);
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid job ID" });
  }

  const db = useDb();

  const job = db
    .select()
    .from(schema.jobRuns)
    .where(eq(schema.jobRuns.id, id))
    .get();

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: "Job not found" });
  }

  if (job.status !== "failed") {
    throw createError({
      statusCode: 400,
      statusMessage: "Only failed jobs can be fixed",
    });
  }

  const gist = db
    .select()
    .from(schema.gists)
    .where(eq(schema.gists.id, job.gistId))
    .get();

  if (!gist) {
    throw createError({ statusCode: 404, statusMessage: "Gist not found" });
  }

  // Download original script
  const scriptRes = await fetch(gist.rawUrl);
  if (!scriptRes.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to download script",
    });
  }
  const originalScript = await scriptRes.text();

  // Ask Claude to fix it
  const { fixedScript, explanation } = await fixScript(
    originalScript,
    job.errorLog || "Unknown error",
    gist.filename
  );

  // Create a new job run with the fixed script
  const newJobId = createJobRun(gist.id, "manual");

  // Run the fixed script in background (fire-and-forget)
  runFixedJob(newJobId, gist, fixedScript, explanation).catch((err) => {
    console.error(`[fix] Fixed job ${newJobId} error:`, err);
  });

  return {
    jobId: newJobId,
    explanation,
  };
});

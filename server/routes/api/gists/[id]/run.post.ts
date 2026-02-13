import { createJobRun, runJob } from "../../../../services/job-runner";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = parseInt(getRouterParam(event, "id") || "", 10);
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid gist ID" });
  }

  const jobId = createJobRun(id, "manual");

  // Fire-and-forget: run the job in the background
  runJob(jobId, id, "manual").catch((err) => {
    console.error(`[api] Job ${jobId} error:`, err);
  });

  return { jobId };
});

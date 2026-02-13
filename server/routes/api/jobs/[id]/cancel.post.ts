import { cancelJob } from "../../../../services/job-runner";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = parseInt(getRouterParam(event, "id") || "", 10);
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid job ID" });
  }

  const cancelled = cancelJob(id);
  if (!cancelled) {
    throw createError({
      statusCode: 400,
      statusMessage: "Job cannot be cancelled (not running or pending)",
    });
  }

  return { cancelled: true };
});

import { eq, count } from "drizzle-orm";
import { useDb, schema } from "../../database";
import { getRunningProcesses } from "../../services/job-runner";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const db = useDb();

  const totalGists = db
    .select({ count: count() })
    .from(schema.gists)
    .get();

  const activeGists = db
    .select({ count: count() })
    .from(schema.gists)
    .where(eq(schema.gists.active, true))
    .get();

  const totalJobs = db
    .select({ count: count() })
    .from(schema.jobRuns)
    .get();

  const successJobs = db
    .select({ count: count() })
    .from(schema.jobRuns)
    .where(eq(schema.jobRuns.status, "success"))
    .get();

  const failedJobs = db
    .select({ count: count() })
    .from(schema.jobRuns)
    .where(eq(schema.jobRuns.status, "failed"))
    .get();

  const runningJobs = db
    .select({ count: count() })
    .from(schema.jobRuns)
    .where(eq(schema.jobRuns.status, "running"))
    .get();

  return {
    gists: {
      total: totalGists?.count || 0,
      active: activeGists?.count || 0,
      disabled: (totalGists?.count || 0) - (activeGists?.count || 0),
    },
    jobs: {
      total: totalJobs?.count || 0,
      success: successJobs?.count || 0,
      failed: failedJobs?.count || 0,
      running: runningJobs?.count || 0,
    },
    runningProcesses: getRunningProcesses().size,
    cronSchedule: process.env.CRON_SCHEDULE || "0 0 * * 0",
    gistPrefix: process.env.GIST_PREFIX || "chart_",
    githubUser: process.env.GITHUB_USER || "",
    minioConfigured: !!(process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY),
    claudeConfigured: !!process.env.ANTHROPIC_API_KEY,
    githubTokenConfigured: !!process.env.GITHUB_TOKEN,
  };
});

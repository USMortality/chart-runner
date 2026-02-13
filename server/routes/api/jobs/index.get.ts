import { desc, eq } from "drizzle-orm";
import { useDb, schema } from "../../../database";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const page = parseInt((query.page as string) || "1", 10);
  const limit = parseInt((query.limit as string) || "20", 10);
  const offset = (page - 1) * limit;

  const db = useDb();

  const jobs = db
    .select({
      id: schema.jobRuns.id,
      gistId: schema.jobRuns.gistId,
      status: schema.jobRuns.status,
      startedAt: schema.jobRuns.startedAt,
      finishedAt: schema.jobRuns.finishedAt,
      errorLog: schema.jobRuns.errorLog,
      outputLog: schema.jobRuns.outputLog,
      retryCount: schema.jobRuns.retryCount,
      triggeredBy: schema.jobRuns.triggeredBy,
      pngFiles: schema.jobRuns.pngFiles,
      createdAt: schema.jobRuns.createdAt,
      gistFilename: schema.gists.filename,
    })
    .from(schema.jobRuns)
    .leftJoin(schema.gists, eq(schema.jobRuns.gistId, schema.gists.id))
    .orderBy(desc(schema.jobRuns.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return { jobs, page, limit };
});

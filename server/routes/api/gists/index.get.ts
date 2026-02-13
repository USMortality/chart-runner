import { eq, desc } from "drizzle-orm";
import { useDb, schema } from "../../../database";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const db = useDb();
  const gists = db.select().from(schema.gists).all();

  // Attach latest run status to each gist
  const result = gists.map((gist) => {
    const latestRun = db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.gistId, gist.id))
      .orderBy(desc(schema.jobRuns.createdAt))
      .limit(1)
      .get();

    return {
      ...gist,
      latestRun: latestRun || null,
    };
  });

  return result;
});

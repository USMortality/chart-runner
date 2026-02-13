import { eq, desc } from "drizzle-orm";
import { useDb, schema } from "../../database";

export default defineEventHandler(async () => {
  const db = useDb();

  const minioEndpoint = process.env.MINIO_ENDPOINT || "localhost";
  const useSSL = process.env.MINIO_USE_SSL === "true";
  const bucket = process.env.MINIO_BUCKET || "charts";
  const baseUrl = `${useSSL ? "https" : "http"}://${minioEndpoint}/${bucket}`;

  const activeGists = db
    .select()
    .from(schema.gists)
    .where(eq(schema.gists.active, true))
    .all();

  const charts = [];

  for (const gist of activeGists) {
    const latestRun = db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.gistId, gist.id))
      .orderBy(desc(schema.jobRuns.createdAt))
      .limit(1)
      .get();

    if (!latestRun?.pngFiles) continue;

    const pngFiles: string[] = JSON.parse(latestRun.pngFiles);
    if (pngFiles.length === 0) continue;

    charts.push({
      title:
        gist.description ||
        gist.filename.replace(/^chart_/, "").replace(/\.r$/i, ""),
      url: gist.htmlUrl,
      charts: pngFiles.map((f) => `${baseUrl}/${f}`),
    });
  }

  return charts;
});

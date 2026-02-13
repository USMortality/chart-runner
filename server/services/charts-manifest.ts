import { eq, desc } from "drizzle-orm";
import { useDb, schema } from "../database";
import { uploadJson } from "./minio-upload";

export async function rebuildManifest() {
  const db = useDb();

  const activeGists = db
    .select()
    .from(schema.gists)
    .where(eq(schema.gists.active, true))
    .all();

  const manifest: Array<{
    filename: string;
    description: string;
    gistUrl: string;
    pngFiles: string[];
    lastRun: string | null;
    status: string;
  }> = [];

  for (const gist of activeGists) {
    const latestRun = db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.gistId, gist.id))
      .orderBy(desc(schema.jobRuns.createdAt))
      .limit(1)
      .get();

    manifest.push({
      filename: gist.filename,
      description: gist.description || "",
      gistUrl: gist.htmlUrl,
      pngFiles: latestRun?.pngFiles ? JSON.parse(latestRun.pngFiles) : [],
      lastRun: latestRun?.finishedAt || null,
      status: latestRun?.status || "never_run",
    });
  }

  const json = JSON.stringify(manifest, null, 2);
  await uploadJson(json, "charts.json");

  return manifest;
}

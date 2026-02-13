import { eq } from "drizzle-orm";
import { useDb, schema } from "../../../../database";
import { pushFixToGist } from "../../../../services/gist-push";

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

  if (!job.fixedScript) {
    throw createError({
      statusCode: 400,
      statusMessage: "This job has no Claude-fixed script to push",
    });
  }

  if (job.status !== "success") {
    throw createError({
      statusCode: 400,
      statusMessage: "Only successful fixed jobs can be pushed to GitHub",
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

  await pushFixToGist(gist.githubId, gist.filename, job.fixedScript);

  // Re-sync the gist's raw_url since it changes after update
  const gistRes = await fetch(
    `https://api.github.com/gists/${gist.githubId}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "chart-runner",
      },
    }
  );

  if (gistRes.ok) {
    const gistData = await gistRes.json();
    const file = gistData.files?.[gist.filename];
    if (file?.raw_url) {
      db.update(schema.gists)
        .set({
          rawUrl: file.raw_url,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.gists.id, gist.id))
        .run();
    }
  }

  return { pushed: true, gistUrl: gist.htmlUrl };
});

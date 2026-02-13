import { eq } from "drizzle-orm";
import { useDb, schema } from "../../../../database";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = parseInt(getRouterParam(event, "id") || "", 10);
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid gist ID" });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw createError({ statusCode: 500, statusMessage: "GITHUB_TOKEN not set" });
  }

  const prefix = process.env.GIST_PREFIX || "chart_";
  const db = useDb();

  const gist = db
    .select()
    .from(schema.gists)
    .where(eq(schema.gists.id, id))
    .get();

  if (!gist) {
    throw createError({ statusCode: 404, statusMessage: "Gist not found" });
  }

  const disabledPrefix = "." + prefix;
  const isCurrentlyDisabled = gist.filename.startsWith(disabledPrefix);

  // Compute new filename
  let newFilename: string;
  if (isCurrentlyDisabled) {
    // Enable: remove the leading dot
    newFilename = gist.filename.slice(1);
  } else {
    // Disable: add a leading dot
    newFilename = "." + gist.filename;
  }

  // Rename the file on GitHub via PATCH
  const res = await fetch(`https://api.github.com/gists/${gist.githubId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `token ${token}`,
      "User-Agent": "chart-runner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        [gist.filename]: {
          filename: newFilename,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw createError({
      statusCode: 500,
      statusMessage: `GitHub rename failed: ${res.status} ${body}`,
    });
  }

  // Parse the response to get updated raw_url
  const updatedGist = await res.json();
  const updatedFile = Object.values(updatedGist.files).find(
    (f: any) => f.filename === newFilename
  ) as any;

  // Update local DB
  db.update(schema.gists)
    .set({
      filename: newFilename,
      active: !isCurrentlyDisabled ? false : true,
      rawUrl: updatedFile?.raw_url || gist.rawUrl,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.gists.id, id))
    .run();

  return {
    id: gist.id,
    filename: newFilename,
    active: isCurrentlyDisabled,
    action: isCurrentlyDisabled ? "enabled" : "disabled",
  };
});

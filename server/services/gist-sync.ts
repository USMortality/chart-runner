import { eq } from "drizzle-orm";
import { useDb, schema } from "../database";

interface GithubGist {
  id: string;
  html_url: string;
  description: string | null;
  files: Record<
    string,
    {
      filename: string;
      raw_url: string;
      language: string | null;
    }
  >;
}

export async function syncGists() {
  const githubUser = process.env.GITHUB_USER;
  if (!githubUser) {
    throw new Error("GITHUB_USER not set");
  }

  const db = useDb();
  const allGists: GithubGist[] = [];
  let page = 1;

  // Paginate through all gists
  while (true) {
    const res = await fetch(
      `https://api.github.com/users/${githubUser}/gists?per_page=100&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "chart-runner",
        },
      }
    );
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    const gists: GithubGist[] = await res.json();
    if (gists.length === 0) break;
    allGists.push(...gists);
    page++;
  }

  // Filter for chart_* R files
  const chartGists: Array<{
    githubId: string;
    htmlUrl: string;
    filename: string;
    description: string;
    rawUrl: string;
  }> = [];

  for (const gist of allGists) {
    for (const file of Object.values(gist.files)) {
      if (
        file.filename.startsWith("chart_") &&
        file.filename.endsWith(".R")
      ) {
        chartGists.push({
          githubId: gist.id,
          htmlUrl: gist.html_url,
          filename: file.filename,
          description: gist.description || "",
          rawUrl: file.raw_url,
        });
      }
    }
  }

  // Upsert gists
  const seenGithubIds = new Set<string>();
  for (const g of chartGists) {
    seenGithubIds.add(g.githubId);
    const existing = db
      .select()
      .from(schema.gists)
      .where(eq(schema.gists.githubId, g.githubId))
      .get();

    if (existing) {
      db.update(schema.gists)
        .set({
          htmlUrl: g.htmlUrl,
          filename: g.filename,
          description: g.description,
          rawUrl: g.rawUrl,
          active: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.gists.id, existing.id))
        .run();
    } else {
      db.insert(schema.gists)
        .values({
          githubId: g.githubId,
          htmlUrl: g.htmlUrl,
          filename: g.filename,
          description: g.description,
          rawUrl: g.rawUrl,
        })
        .run();
    }
  }

  // Deactivate gists no longer present
  const allDbGists = db.select().from(schema.gists).all();
  for (const dbGist of allDbGists) {
    if (!seenGithubIds.has(dbGist.githubId)) {
      db.update(schema.gists)
        .set({ active: false, updatedAt: new Date().toISOString() })
        .where(eq(schema.gists.id, dbGist.id))
        .run();
    }
  }

  return { synced: chartGists.length, total: allGists.length };
}

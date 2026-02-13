export async function pushFixToGist(
  githubGistId: string,
  filename: string,
  content: string
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not set");
  }

  const res = await fetch(`https://api.github.com/gists/${githubGistId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `token ${token}`,
      "User-Agent": "chart-runner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        [filename]: {
          content,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${body}`);
  }
}

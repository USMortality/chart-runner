import Anthropic from "@anthropic-ai/sdk";

export async function fixScript(
  script: string,
  errorLog: string,
  filename: string
): Promise<{ fixedScript: string; explanation: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `This R script "${filename}" failed with the following error. Please fix it.

Return ONLY the fixed R script inside a \`\`\`r code block, followed by a brief explanation of what you changed.

## Script
\`\`\`r
${script}
\`\`\`

## Error
\`\`\`
${errorLog}
\`\`\``,
      },
    ],
  });

  const firstBlock = message.content[0];
  const text =
    firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

  // Extract R code block
  const codeMatch = text.match(/```r\n([\s\S]*?)```/);
  if (!codeMatch) {
    throw new Error("Claude did not return a valid R code block");
  }

  const fixedScript = codeMatch[1]!.trim();

  // Extract explanation (everything after the code block)
  const explanation = text
    .slice(text.indexOf("```", text.indexOf("```r") + 4) + 3)
    .trim();

  return { fixedScript, explanation };
}

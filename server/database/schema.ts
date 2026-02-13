import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const gists = sqliteTable("gists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: text("github_id").notNull().unique(),
  htmlUrl: text("html_url").notNull(),
  filename: text("filename").notNull(),
  description: text("description").default(""),
  rawUrl: text("raw_url").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const jobRuns = sqliteTable("job_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gistId: integer("gist_id")
    .notNull()
    .references(() => gists.id),
  status: text("status", {
    enum: ["pending", "running", "success", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  errorLog: text("error_log"),
  outputLog: text("output_log"),
  retryCount: integer("retry_count").notNull().default(0),
  triggeredBy: text("triggered_by", {
    enum: ["manual", "scheduled"],
  }).notNull(),
  pngFiles: text("png_files").default("[]"),
  fixedScript: text("fixed_script"),
  fixExplanation: text("fix_explanation"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

import { spawn, type ChildProcess } from "child_process";
import { mkdtemp, writeFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { eq, and, ne } from "drizzle-orm";
import { useDb, schema } from "../database";
import { uploadPng, ensureBucket } from "./minio-upload";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

// Track running processes for cancellation
const runningProcesses = new Map<number, ChildProcess>();

export function getRunningProcesses() {
  return runningProcesses;
}

async function downloadScript(rawUrl: string, dest: string): Promise<void> {
  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`Failed to download script: ${res.status}`);
  const text = await res.text();
  await writeFile(dest, text);
}

function runRscript(
  scriptPath: string,
  workDir: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("Rscript", [scriptPath], {
      cwd: workDir,
      env: { ...process.env, HOME: workDir },
      timeout: 600_000, // 10 min timeout
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: stderr + "\n" + err.message, exitCode: 1 });
    });

    // Store process reference using pid for cancellation
    if (proc.pid) {
      (proc as any).__jobId = undefined; // set later
    }

    // Expose proc for the caller to register
    (runRscript as any).__lastProc = proc;
  });
}

export async function runJob(
  jobId: number,
  gistId: number,
  triggeredBy: "manual" | "scheduled" = "manual"
): Promise<void> {
  const db = useDb();

  const gist = db
    .select()
    .from(schema.gists)
    .where(eq(schema.gists.id, gistId))
    .get();

  if (!gist) {
    throw new Error(`Gist ${gistId} not found`);
  }

  const chartName = gist.filename.replace(/\.[rR]$/, "");
  let attempt = 0;
  let lastError = "";

  while (attempt < MAX_RETRIES) {
    // Check if job was cancelled
    const currentJob = db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.id, jobId))
      .get();
    if (currentJob?.status === "cancelled") {
      return;
    }

    attempt++;
    const workDir = await mkdtemp(join(tmpdir(), "chart-runner-"));

    try {
      // Update status to running
      db.update(schema.jobRuns)
        .set({
          status: "running",
          startedAt: new Date().toISOString(),
          retryCount: attempt - 1,
        })
        .where(eq(schema.jobRuns.id, jobId))
        .run();

      // Download the R script
      const scriptPath = join(workDir, gist.filename);
      await downloadScript(gist.rawUrl, scriptPath);

      // Run Rscript
      const resultPromise = runRscript(scriptPath, workDir);

      // Register the process for cancellation
      const proc = (runRscript as any).__lastProc as ChildProcess;
      if (proc) {
        runningProcesses.set(jobId, proc);
      }

      const result = await resultPromise;
      runningProcesses.delete(jobId);

      // Re-check cancellation after execution
      const jobAfterRun = db
        .select()
        .from(schema.jobRuns)
        .where(eq(schema.jobRuns.id, jobId))
        .get();
      if (jobAfterRun?.status === "cancelled") {
        await rm(workDir, { recursive: true, force: true });
        return;
      }

      if (result.exitCode !== 0) {
        lastError = result.stderr || "Rscript exited with non-zero code";
        // Retry with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
        await rm(workDir, { recursive: true, force: true });
        continue;
      }

      // Collect PNG files
      const files = await readdir(workDir);
      const pngFiles = files.filter((f) => f.endsWith(".png"));

      // Upload PNGs to MinIO
      const uploadedPaths: string[] = [];
      try {
        await ensureBucket();
        for (const png of pngFiles) {
          const objectName = await uploadPng(join(workDir, png), chartName);
          uploadedPaths.push(objectName);
        }
      } catch (uploadErr: any) {
        console.error(`[job-runner] MinIO upload error: ${uploadErr.message}`);
        // Still mark as success if R script succeeded but upload failed
        // Store the error in output log
        db.update(schema.jobRuns)
          .set({
            status: "success",
            finishedAt: new Date().toISOString(),
            outputLog:
              result.stdout +
              `\n[WARNING] MinIO upload failed: ${uploadErr.message}`,
            pngFiles: JSON.stringify(pngFiles),
            retryCount: attempt - 1,
          })
          .where(eq(schema.jobRuns.id, jobId))
          .run();

        await rm(workDir, { recursive: true, force: true });
        return;
      }

      // Mark success
      db.update(schema.jobRuns)
        .set({
          status: "success",
          finishedAt: new Date().toISOString(),
          outputLog: result.stdout,
          pngFiles: JSON.stringify(uploadedPaths),
          retryCount: attempt - 1,
        })
        .where(eq(schema.jobRuns.id, jobId))
        .run();

      await rm(workDir, { recursive: true, force: true });
      return;
    } catch (err: any) {
      runningProcesses.delete(jobId);
      lastError = err.message;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // All retries exhausted
  db.update(schema.jobRuns)
    .set({
      status: "failed",
      finishedAt: new Date().toISOString(),
      errorLog: lastError,
      retryCount: attempt - 1,
    })
    .where(eq(schema.jobRuns.id, jobId))
    .run();
}

export function cancelJob(jobId: number): boolean {
  const db = useDb();

  const job = db
    .select()
    .from(schema.jobRuns)
    .where(eq(schema.jobRuns.id, jobId))
    .get();

  if (!job) return false;

  if (job.status === "running") {
    const proc = runningProcesses.get(jobId);
    if (proc) {
      proc.kill("SIGTERM");
      runningProcesses.delete(jobId);
    }
  }

  if (job.status === "running" || job.status === "pending") {
    db.update(schema.jobRuns)
      .set({
        status: "cancelled",
        finishedAt: new Date().toISOString(),
      })
      .where(eq(schema.jobRuns.id, jobId))
      .run();
    return true;
  }

  return false;
}

export function createJobRun(
  gistId: number,
  triggeredBy: "manual" | "scheduled"
): number {
  const db = useDb();

  // Delete all previous runs for this gist
  db.delete(schema.jobRuns)
    .where(eq(schema.jobRuns.gistId, gistId))
    .run();

  const result = db
    .insert(schema.jobRuns)
    .values({
      gistId,
      triggeredBy,
      status: "pending",
    })
    .returning({ id: schema.jobRuns.id })
    .get();
  return result.id;
}

export async function runFixedJob(
  jobId: number,
  gist: { id: number; filename: string },
  fixedScript: string,
  explanation?: string
): Promise<void> {
  const db = useDb();
  const chartName = gist.filename.replace(/\.[rR]$/, "");
  const workDir = await mkdtemp(join(tmpdir(), "chart-runner-fix-"));

  try {
    db.update(schema.jobRuns)
      .set({
        status: "running",
        startedAt: new Date().toISOString(),
        outputLog: "[Claude-fixed script]\n",
        fixedScript,
        fixExplanation: explanation || null,
      })
      .where(eq(schema.jobRuns.id, jobId))
      .run();

    const scriptPath = join(workDir, gist.filename);
    await writeFile(scriptPath, fixedScript);

    const resultPromise = runRscript(scriptPath, workDir);
    const proc = (runRscript as any).__lastProc as ChildProcess;
    if (proc) runningProcesses.set(jobId, proc);

    const result = await resultPromise;
    runningProcesses.delete(jobId);

    if (result.exitCode !== 0) {
      db.update(schema.jobRuns)
        .set({
          status: "failed",
          finishedAt: new Date().toISOString(),
          errorLog: result.stderr,
          outputLog: "[Claude-fixed script]\n" + result.stdout,
        })
        .where(eq(schema.jobRuns.id, jobId))
        .run();
      return;
    }

    const files = await readdir(workDir);
    const pngFiles = files.filter((f) => f.endsWith(".png"));

    const uploadedPaths: string[] = [];
    try {
      await ensureBucket();
      for (const png of pngFiles) {
        const objectName = await uploadPng(join(workDir, png), chartName);
        uploadedPaths.push(objectName);
      }
    } catch {
      // Upload failed, still mark success
    }

    db.update(schema.jobRuns)
      .set({
        status: "success",
        finishedAt: new Date().toISOString(),
        outputLog: "[Claude-fixed script]\n" + result.stdout,
        pngFiles: JSON.stringify(uploadedPaths.length ? uploadedPaths : pngFiles),
      })
      .where(eq(schema.jobRuns.id, jobId))
      .run();

  } catch (err: any) {
    runningProcesses.delete(jobId);
    db.update(schema.jobRuns)
      .set({
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorLog: err.message,
      })
      .where(eq(schema.jobRuns.id, jobId))
      .run();
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

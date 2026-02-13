import { Client } from "minio";
import { readFile } from "fs/promises";
import { basename } from "path";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const port = parseInt(process.env.MINIO_PORT || "9000", 10);
    const useSSL = process.env.MINIO_USE_SSL === "true";
    _client = new Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || "",
      secretKey: process.env.MINIO_SECRET_KEY || "",
    });
  }
  return _client;
}

function getBucket(): string {
  return process.env.MINIO_BUCKET || "charts";
}

export async function ensureBucket() {
  const client = getClient();
  const bucket = getBucket();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
    console.log(`[minio] Created bucket: ${bucket}`);
  }
}

export async function uploadPng(
  filePath: string,
  chartName: string
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();
  const fileName = basename(filePath);
  const objectName = `${chartName}/${fileName}`;

  const fileBuffer = await readFile(filePath);
  await client.putObject(bucket, objectName, fileBuffer, fileBuffer.length, {
    "Content-Type": "image/png",
  });

  console.log(`[minio] Uploaded: ${objectName}`);
  return objectName;
}

export async function uploadJson(
  content: string,
  objectName: string
): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  const buffer = Buffer.from(content);
  await client.putObject(bucket, objectName, buffer, buffer.length, {
    "Content-Type": "application/json",
  });
  console.log(`[minio] Uploaded: ${objectName}`);
}

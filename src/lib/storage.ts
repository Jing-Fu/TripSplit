import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new StorageError("R2 credentials not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new StorageError("R2_BUCKET not configured");
  return bucket;
}

export async function uploadObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<{ key: string; sizeBytes: number }> {
  try {
    const client = getClient();
    const bucket = getBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { key, sizeBytes: buffer.length };
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(`Failed to upload ${key}`, err);
  }
}

export async function getSignedReadUrl(
  key: string,
  ttlSeconds = 3600
): Promise<string> {
  try {
    const client = getClient();
    const bucket = getBucket();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(client, command, { expiresIn: ttlSeconds });
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(`Failed to get signed URL for ${key}`, err);
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    const client = getClient();
    const bucket = getBucket();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(`Failed to delete ${key}`, err);
  }
}

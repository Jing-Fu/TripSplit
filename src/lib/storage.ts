import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

export function getReceiptStoragePrefix(userId: string): string {
  return `uploads/${userId}/`;
}

export function isReceiptStorageKeyForUser(key: string, userId: string): boolean {
  return key.startsWith(getReceiptStoragePrefix(userId));
}

export function isReceiptStorageKey(key: string): boolean {
  return /^uploads\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]+$/.test(
    key
  );
}

type StorageProvider = "supabase";

let supabaseStorageClient: SupabaseClient | null = null;

function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "supabase";

  if (provider !== "supabase") {
    throw new StorageError(`Unsupported storage provider: ${provider}`);
  }

  return provider;
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseStorageClient) return supabaseStorageClient;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new StorageError("Supabase Storage credentials not configured");
  }

  supabaseStorageClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return supabaseStorageClient;
}

function getBucket(): string {
  const bucket = process.env.STORAGE_BUCKET ?? process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) throw new StorageError("STORAGE_BUCKET not configured");
  return bucket;
}

export async function uploadObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<{ key: string; sizeBytes: number }> {
  try {
    getStorageProvider();
    const client = getSupabaseClient();
    const bucket = getBucket();
    const { error } = await client.storage.from(bucket).upload(key, buffer, {
      contentType,
      upsert: false,
    });

    if (error) throw error;

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
    getStorageProvider();
    const client = getSupabaseClient();
    const bucket = getBucket();
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(key, ttlSeconds);

    if (error) throw error;

    return data.signedUrl;
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(`Failed to get signed URL for ${key}`, err);
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    getStorageProvider();
    const client = getSupabaseClient();
    const bucket = getBucket();
    const { error } = await client.storage.from(bucket).remove([key]);

    if (error) throw error;
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(`Failed to delete ${key}`, err);
  }
}

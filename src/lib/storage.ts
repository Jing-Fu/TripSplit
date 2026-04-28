import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Abstraction over file persistence so upload / backup routes
 * don't depend on the local filesystem directly.
 *
 * Default implementation writes to `public/` (local FS).
 * Swap with `setStorage()` for S3, GCS, R2, etc.
 */
export interface StorageAdapter {
  /** Persist a file and return a public-facing URL path. */
  writeFile(
    relativePath: string,
    content: Buffer | string,
    encoding?: BufferEncoding
  ): Promise<string>;
}

class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(process.cwd(), "public");
  }

  async writeFile(
    relativePath: string,
    content: Buffer | string,
    encoding?: BufferEncoding
  ): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, encoding);
    return `/${relativePath}`;
  }
}

let storage: StorageAdapter = new LocalStorageAdapter();

export function getStorage(): StorageAdapter {
  return storage;
}

export function setStorage(adapter: StorageAdapter): void {
  storage = adapter;
}

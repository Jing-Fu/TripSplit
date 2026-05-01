import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();
const removeMock = vi.fn();
const fromMock = vi.fn(() => ({
  upload: uploadMock,
  createSignedUrl: createSignedUrlMock,
  remove: removeMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: fromMock },
  })),
}));

import {
  uploadObject,
  getSignedReadUrl,
  deleteObject,
  getReceiptStoragePrefix,
  isReceiptStorageKey,
  isReceiptStorageKeyForUser,
  StorageError,
} from "@/lib/storage";

const mockEnv = {
  STORAGE_PROVIDER: "supabase",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SECRET_KEY: "test-secret-key",
  STORAGE_BUCKET: "test-bucket",
};

describe("storage", () => {
  beforeEach(() => {
    Object.assign(process.env, mockEnv);
    vi.clearAllMocks();
  });

  it("uploadObject returns key and sizeBytes on success", async () => {
    uploadMock.mockResolvedValueOnce({ data: { path: "receipts/test.jpg" }, error: null });

    const buf = Buffer.from("hello");
    const result = await uploadObject("receipts/test.jpg", buf, "image/jpeg");

    expect(result.key).toBe("receipts/test.jpg");
    expect(result.sizeBytes).toBe(5);
    expect(fromMock).toHaveBeenCalledWith("test-bucket");
    expect(uploadMock).toHaveBeenCalledWith("receipts/test.jpg", buf, {
      contentType: "image/jpeg",
      upsert: false,
    });
  });

  it("getSignedReadUrl returns a URL string", async () => {
    createSignedUrlMock.mockResolvedValueOnce({
      data: { signedUrl: "https://storage.example.com/signed-url" },
      error: null,
    });

    const url = await getSignedReadUrl("receipts/test.jpg");

    expect(url).toBe("https://storage.example.com/signed-url");
    expect(createSignedUrlMock).toHaveBeenCalledWith("receipts/test.jpg", 3600);
  });

  it("deleteObject resolves without error", async () => {
    removeMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(deleteObject("receipts/test.jpg")).resolves.toBeUndefined();
    expect(removeMock).toHaveBeenCalledWith(["receipts/test.jpg"]);
  });

  it("uploadObject throws StorageError on failure", async () => {
    uploadMock.mockResolvedValueOnce({ data: null, error: new Error("Storage error") });

    const buf = Buffer.from("hello");
    await expect(uploadObject("receipts/test.jpg", buf, "image/jpeg")).rejects.toBeInstanceOf(StorageError);
  });

  it("recognizes only generated receipt storage keys", () => {
    const key = "uploads/user-1/550e8400-e29b-41d4-a716-446655440000.jpg";

    expect(getReceiptStoragePrefix("user-1")).toBe("uploads/user-1/");
    expect(isReceiptStorageKey(key)).toBe(true);
    expect(isReceiptStorageKeyForUser(key, "user-1")).toBe(true);
    expect(isReceiptStorageKeyForUser(key, "user-2")).toBe(false);
    expect(isReceiptStorageKey("backups/trip-1.json")).toBe(false);
    expect(isReceiptStorageKey("uploads/user-1/not-a-uuid.jpg")).toBe(false);
  });

  it("falls back to legacy service role key env name", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-key";
    uploadMock.mockResolvedValueOnce({ data: { path: "receipts/test.jpg" }, error: null });

    await expect(uploadObject("receipts/test.jpg", Buffer.from("hello"), "image/jpeg")).resolves.toMatchObject({
      key: "receipts/test.jpg",
      sizeBytes: 5,
    });
  });
});

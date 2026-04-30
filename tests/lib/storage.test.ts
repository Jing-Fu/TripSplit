import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

import { uploadObject, getSignedReadUrl, deleteObject, StorageError } from "@/lib/storage";
import * as s3 from "@aws-sdk/client-s3";
import * as presigner from "@aws-sdk/s3-request-presigner";

const mockEnv = {
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-key",
  R2_SECRET_ACCESS_KEY: "test-secret",
  R2_BUCKET: "test-bucket",
};

describe("storage", () => {
  beforeEach(() => {
    Object.assign(process.env, mockEnv);
    vi.clearAllMocks();
    const mockClient = { send: vi.fn() };
    vi.mocked(s3.S3Client).mockImplementation(() => mockClient as any);
    (s3 as any).__mockClient = mockClient;
  });

  it("uploadObject returns key and sizeBytes on success", async () => {
    const mockClient = (s3 as any).__mockClient;
    mockClient.send.mockResolvedValueOnce({});

    const buf = Buffer.from("hello");
    const result = await uploadObject("receipts/test.jpg", buf, "image/jpeg");

    expect(result.key).toBe("receipts/test.jpg");
    expect(result.sizeBytes).toBe(5);
  });

  it("getSignedReadUrl returns a URL string", async () => {
    vi.mocked(presigner.getSignedUrl).mockResolvedValueOnce("https://r2.example.com/signed-url");

    const url = await getSignedReadUrl("receipts/test.jpg");

    expect(url).toBe("https://r2.example.com/signed-url");
  });

  it("deleteObject resolves without error", async () => {
    const mockClient = (s3 as any).__mockClient;
    mockClient.send.mockResolvedValueOnce({});

    await expect(deleteObject("receipts/test.jpg")).resolves.toBeUndefined();
  });

  it("uploadObject throws StorageError on failure", async () => {
    const mockClient = (s3 as any).__mockClient;
    mockClient.send.mockRejectedValueOnce(new Error("S3 error"));

    const buf = Buffer.from("hello");
    await expect(uploadObject("receipts/test.jpg", buf, "image/jpeg")).rejects.toBeInstanceOf(StorageError);
  });
});

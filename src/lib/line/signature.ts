import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify LINE webhook signature using HMAC-SHA256.
 * Must use raw body string (before JSON.parse) to match LINE's signature.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  try {
    const expectedBuf = Buffer.from(expected, "base64");
    const actualBuf = Buffer.from(signature, "base64");
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

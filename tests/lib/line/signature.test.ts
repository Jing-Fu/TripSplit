import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyLineSignature } from "@/lib/line/signature";
import { signLineWebhook } from "../../utils/sign-webhook";

describe("verifyLineSignature", () => {
  const secret = "test-channel-secret";
  const body = JSON.stringify({ events: [] });

  it("returns true for valid signature", () => {
    const sig = signLineWebhook(body, secret);
    expect(verifyLineSignature(body, sig, secret)).toBe(true);
  });

  it("returns false for tampered body", () => {
    const sig = signLineWebhook(body, secret);
    expect(verifyLineSignature(body + "x", sig, secret)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const sig = signLineWebhook(body, "wrong-secret");
    expect(verifyLineSignature(body, sig, secret)).toBe(false);
  });

  it("returns false for null signature", () => {
    expect(verifyLineSignature(body, null, secret)).toBe(false);
  });
});

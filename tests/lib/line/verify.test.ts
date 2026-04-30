import { describe, it, expect, vi, beforeEach } from "vitest";
import validToken from "../../fixtures/line/valid-id-token.json";
import expiredToken from "../../fixtures/line/expired-id-token.json";
import { verifyLiffIdToken } from "@/lib/line/verify";
import { LineAuthError } from "@/lib/line/errors";

const CHANNEL_ID = "test-liff-channel-id";

describe("verifyLiffIdToken", () => {
  beforeEach(() => {
    process.env.LIFF_CHANNEL_ID = CHANNEL_ID;
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns lineUserId and name for valid token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => validToken,
    } as Response);

    const result = await verifyLiffIdToken("fake-token");

    expect(result.lineUserId).toBe("U_test_user_001");
    expect(result.name).toBe("テストユーザー");
    expect(result.picture).toBe("https://example.com/avatar.jpg");
  });

  it("throws LineAuthError with code 'expired' for expired token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => expiredToken,
    } as Response);

    await expect(verifyLiffIdToken("fake-token")).rejects.toThrow(LineAuthError);
    await expect(verifyLiffIdToken("fake-token")).rejects.toMatchObject({ code: "expired" });
  });

  it("throws LineAuthError with code 'audience_mismatch' for wrong aud", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...validToken, aud: "wrong-channel" }),
    } as Response);

    await expect(verifyLiffIdToken("fake-token")).rejects.toThrow(LineAuthError);
    await expect(verifyLiffIdToken("fake-token")).rejects.toMatchObject({ code: "audience_mismatch" });
  });

  it("throws LineAuthError with code 'verify_failed' when LINE API returns 503", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(verifyLiffIdToken("fake-token")).rejects.toThrow(LineAuthError);
    await expect(verifyLiffIdToken("fake-token")).rejects.toMatchObject({ code: "verify_failed" });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import pushSuccess from "../../fixtures/line/push-success-response.json";
import pushBlocked from "../../fixtures/line/push-blocked-response.json";

describe("pushText", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns { delivered: true } on success", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => pushSuccess,
    });

    const { pushText } = await import("@/lib/line/push");
    const result = await pushText("U_test_user_001", "hello");

    expect(result).toEqual({ delivered: true });
  });

  it("returns { delivered: false, reason: 'blocked' } on 403", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => pushBlocked,
    });

    const { pushText } = await import("@/lib/line/push");
    const result = await pushText("U_test_user_001", "hello");

    expect(result).toEqual({ delivered: false, reason: "blocked" });
  });

  it("retries on 429 and returns rate_limit after max retries", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 429 });

    const { pushText } = await import("@/lib/line/push");
    const result = await pushText("U_test_user_001", "hello");

    expect(result).toEqual({ delivered: false, reason: "rate_limit" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws LinePushError after max retries on 5xx", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const { pushText } = await import("@/lib/line/push");
    const { LinePushError } = await import("@/lib/line/errors");

    await expect(pushText("U_test_user_001", "hello")).rejects.toThrow(LinePushError);
  });
});

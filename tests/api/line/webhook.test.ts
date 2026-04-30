import { describe, it, expect, vi, beforeEach } from "vitest";
import { signLineWebhook } from "../../utils/sign-webhook";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { POST } from "@/app/api/line/webhook/route";
import { prisma } from "@/lib/prisma";

const SECRET = "test-channel-secret";

function makeRequest(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  const sig = signature ?? signLineWebhook(raw, SECRET);
  return new Request("http://localhost/api/line/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-line-signature": sig,
    },
    body: raw,
  });
}

describe("POST /api/line/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_SECRET = SECRET;
  });

  it("returns 401 when signature is missing", async () => {
    const raw = JSON.stringify({ events: [] });
    const request = new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it("returns 401 when signature is wrong", async () => {
    const request = makeRequest({ events: [] }, "bogus-signature");
    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it("handles follow event and enables push", async () => {
    const body = {
      events: [
        {
          type: "follow",
          source: { type: "user", userId: "U_test_user_001" },
        },
      ],
    };

    const request = makeRequest(body);
    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lineUserId: "U_test_user_001" },
        update: { linePushEnabled: true },
      })
    );
  });

  it("handles unfollow event and disables push", async () => {
    const body = {
      events: [
        {
          type: "unfollow",
          source: { type: "user", userId: "U_test_user_001" },
        },
      ],
    };

    const request = makeRequest(body);
    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { lineUserId: "U_test_user_001" },
      data: { linePushEnabled: false },
    });
  });

  it("handles message event as no-op (no DB write)", async () => {
    const body = {
      events: [
        {
          type: "message",
          source: { type: "user", userId: "U_test_user_001" },
          message: { type: "text", text: "hello" },
        },
      ],
    };

    const request = makeRequest(body);
    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

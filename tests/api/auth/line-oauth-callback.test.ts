import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSessionForLineUser = vi.hoisted(() => vi.fn());
const setSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  createSessionForLineUser,
  setSessionCookie,
}));

import { GET } from "@/app/api/auth/line/oauth/callback/route";

describe("GET /api/auth/line/oauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_LOGIN_CHANNEL_ID = "channel-id";
    process.env.LINE_LOGIN_CHANNEL_SECRET = "channel-secret";
    process.env.LINE_LOGIN_REDIRECT_URI =
      "https://example.com/api/auth/line/oauth/callback";

    createSessionForLineUser.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "access-token" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              userId: "U_test_user_001",
              displayName: "Test User",
              pictureUrl: "https://example.com/avatar.jpg",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
    );
  });

  it("accepts a matching state even when other pending states exist", async () => {
    const pendingStates = encodeURIComponent(
      JSON.stringify([
        { state: "state-1", returnTo: "/trips/alpha", expiresAt: 4_102_444_800_000 },
        { state: "state-2", returnTo: "/trips/beta", expiresAt: 4_102_444_800_000 },
      ])
    );

    const request = new NextRequest(
      "https://example.com/api/auth/line/oauth/callback?code=code-123&state=state-1",
      {
        headers: {
          cookie: `line_oauth_states=${pendingStates}`,
        },
      }
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://example.com/trips/alpha");
    expect(createSessionForLineUser).toHaveBeenCalledWith({
      lineUserId: "U_test_user_001",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    });
    expect(setSessionCookie).toHaveBeenCalledOnce();
    expect(response.cookies.get("line_oauth_states")?.value).toContain("state-2");
    expect(response.cookies.get("line_oauth_states")?.value).not.toContain("state-1");
  });
});

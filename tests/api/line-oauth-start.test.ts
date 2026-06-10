import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/line/oauth/start/route";

describe("GET /api/auth/line/oauth/start", () => {
  it("redirects to the callback origin before creating state when origins differ", async () => {
    process.env.LINE_LOGIN_CHANNEL_ID = "channel-id";
    process.env.LINE_LOGIN_REDIRECT_URI =
      "https://trip-split-sandy.vercel.app/api/auth/line/oauth/callback";

    const request = new NextRequest(
      "http://localhost:3000/api/auth/line/oauth/start?returnTo=%2Ftrips%2Falpha"
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://trip-split-sandy.vercel.app/api/auth/line/oauth/start?returnTo=%2Ftrips%2Falpha"
    );
    expect(response.cookies.get("line_oauth_states")).toBeUndefined();
  });

  it("creates state on the current origin when the callback origin already matches", async () => {
    process.env.LINE_LOGIN_CHANNEL_ID = "channel-id";
    process.env.LINE_LOGIN_REDIRECT_URI =
      "https://trip-split-sandy.vercel.app/api/auth/line/oauth/callback";

    const request = new NextRequest(
      "https://trip-split-sandy.vercel.app/api/auth/line/oauth/start?returnTo=%2Ftrips%2Falpha"
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(location).toContain("https://access.line.me/oauth2/v2.1/authorize?");
    expect(location).toContain("client_id=channel-id");
    expect(location).toContain(
      "redirect_uri=https%3A%2F%2Ftrip-split-sandy.vercel.app%2Fapi%2Fauth%2Fline%2Foauth%2Fcallback"
    );
    expect(response.cookies.get("line_oauth_states")?.value).toContain("\"returnTo\":\"/trips/alpha\"");
  });
});

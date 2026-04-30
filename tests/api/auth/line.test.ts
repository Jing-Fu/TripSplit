import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/line/verify", () => ({
  verifyLiffIdToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createSessionForLineUser: vi.fn(),
  setSessionCookie: vi.fn(),
}));

import { POST } from "@/app/api/auth/line/route";
import { verifyLiffIdToken } from "@/lib/line/verify";
import { createSessionForLineUser } from "@/lib/auth";
import { LineAuthError } from "@/lib/line/errors";

const mockProfile = {
  lineUserId: "U_test_user_001",
  name: "Test User",
  picture: "https://example.com/avatar.jpg",
};

const mockSession = {
  token: "session-token-abc",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
};

describe("POST /api/auth/line", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with user and sets cookie for valid token", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValueOnce(mockProfile);
    vi.mocked(createSessionForLineUser).mockResolvedValueOnce(mockSession);

    const request = new Request("http://localhost/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.lineUserId).toBe("U_test_user_001");
  });

  it("returns 401 for expired token", async () => {
    vi.mocked(verifyLiffIdToken).mockRejectedValueOnce(
      new LineAuthError("expired")
    );

    const request = new Request("http://localhost/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "expired-token" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("expired");
  });

  it("returns 401 for audience mismatch", async () => {
    vi.mocked(verifyLiffIdToken).mockRejectedValueOnce(
      new LineAuthError("audience_mismatch")
    );

    const request = new Request("http://localhost/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "bad-aud-token" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when idToken is missing", async () => {
    const request = new Request("http://localhost/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

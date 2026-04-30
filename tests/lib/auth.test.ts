import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionForLineUser, getCurrentUser, AUTH_COOKIE_NAME } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockUser = {
  id: "user-1",
  lineUserId: "U_test_user_001",
  lineDisplayName: "Test User",
  linePictureUrl: "https://example.com/avatar.jpg",
  linePushEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession = {
  id: "session-1",
  token: "test-token-abc",
  userId: "user-1",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  createdAt: new Date(),
  user: mockUser,
};

describe("createSessionForLineUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user and session for new LINE user", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.session.create).mockResolvedValueOnce(mockSession as any);

    const result = await createSessionForLineUser({
      lineUserId: "U_test_user_001",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lineUserId: "U_test_user_001" },
      })
    );
    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("reuses existing user for returning LINE user", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockUser as any);
    vi.mocked(prisma.session.create).mockResolvedValueOnce(mockSession as any);

    await createSessionForLineUser({
      lineUserId: "U_test_user_001",
      name: "Test User",
    });

    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user for valid session cookie", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValueOnce(mockSession as any);

    const request = new Request("http://localhost", {
      headers: { cookie: `${AUTH_COOKIE_NAME}=test-token-abc` },
    });

    const user = await getCurrentUser(request);
    expect(user?.lineUserId).toBe("U_test_user_001");
  });

  it("returns null for expired session", async () => {
    const expiredSession = {
      ...mockSession,
      expiresAt: new Date(Date.now() - 1000),
    };
    vi.mocked(prisma.session.findUnique).mockResolvedValueOnce(expiredSession as any);
    vi.mocked(prisma.session.delete).mockResolvedValueOnce(expiredSession as any);

    const request = new Request("http://localhost", {
      headers: { cookie: `${AUTH_COOKIE_NAME}=expired-token` },
    });

    const user = await getCurrentUser(request);
    expect(user).toBeNull();
  });

  it("returns null when no cookie", async () => {
    const request = new Request("http://localhost");
    const user = await getCurrentUser(request);
    expect(user).toBeNull();
  });
});

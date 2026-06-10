import { describe, expect, it } from "vitest";
import {
  consumePendingLineOAuthState,
  createPendingLineOAuthStates,
  parsePendingLineOAuthStates,
} from "@/lib/line/oauth-state";

describe("LINE OAuth state helpers", () => {
  it("keeps multiple pending states instead of overwriting them", () => {
    const now = 1_700_000_000_000;
    const first = createPendingLineOAuthStates(null, "state-1", "/trips/1", now);
    const second = createPendingLineOAuthStates(
      JSON.stringify(first),
      "state-2",
      "/trips/2",
      now + 1_000
    );

    expect(second).toHaveLength(2);
    expect(second.map((entry) => entry.state)).toEqual(["state-1", "state-2"]);
  });

  it("consumes only the matched state and keeps other pending states", () => {
    const cookieValue = JSON.stringify([
      { state: "state-1", returnTo: "/trips/1", expiresAt: 1_700_000_010_000 },
      { state: "state-2", returnTo: "/trips/2", expiresAt: 1_700_000_020_000 },
    ]);

    const result = consumePendingLineOAuthState(
      cookieValue,
      "state-1",
      1_700_000_000_000
    );

    expect(result.matchedState?.returnTo).toBe("/trips/1");
    expect(result.remainingStates).toHaveLength(1);
    expect(result.remainingStates[0]?.state).toBe("state-2");
  });

  it("drops expired entries while parsing", () => {
    const parsed = parsePendingLineOAuthStates(
      JSON.stringify([
        { state: "expired", returnTo: "/", expiresAt: 99 },
        { state: "valid", returnTo: "/trips/1", expiresAt: 101 },
      ]),
      100
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.state).toBe("valid");
  });
});

const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const MAX_PENDING_STATES = 5;

export const LINE_OAUTH_STATE_COOKIE = "line_oauth_states";

type PendingLineOAuthState = {
  state: string;
  returnTo: string;
  expiresAt: number;
};

function isPendingLineOAuthState(
  value: unknown
): value is PendingLineOAuthState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["state"] === "string" &&
    typeof candidate["returnTo"] === "string" &&
    typeof candidate["expiresAt"] === "number"
  );
}

export function parsePendingLineOAuthStates(
  cookieValue: string | null | undefined,
  now = Date.now()
) {
  if (!cookieValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(cookieValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isPendingLineOAuthState)
      .filter((entry) => entry.expiresAt > now)
      .slice(-MAX_PENDING_STATES);
  } catch {
    return [];
  }
}

export function createPendingLineOAuthStates(
  currentCookieValue: string | null | undefined,
  state: string,
  returnTo: string,
  now = Date.now()
) {
  const currentStates = parsePendingLineOAuthStates(currentCookieValue, now);

  return [
    ...currentStates,
    {
      state,
      returnTo,
      expiresAt: now + OAUTH_STATE_TTL_MS,
    },
  ].slice(-MAX_PENDING_STATES);
}

export function consumePendingLineOAuthState(
  currentCookieValue: string | null | undefined,
  state: string,
  now = Date.now()
) {
  const currentStates = parsePendingLineOAuthStates(currentCookieValue, now);
  const matchedState = currentStates.find((entry) => entry.state === state) ?? null;

  return {
    matchedState,
    remainingStates: currentStates.filter((entry) => entry.state !== state),
  };
}

export function serializePendingLineOAuthStates(
  states: PendingLineOAuthState[]
) {
  return JSON.stringify(states);
}

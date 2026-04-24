/**
 * Centralized fetch wrapper with network error handling.
 * Returns a synthetic Response with status 0 on network failure,
 * allowing callers to check `res.status === 0` consistently.
 */
export function safeFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, init).catch(() => {
    return new Response(
      JSON.stringify({ error: "網路連線失敗，請檢查網路後重試" }),
      {
        status: 0,
        headers: { "Content-Type": "application/json" },
      }
    );
  });
}

/**
 * Parse a Response as JSON safely, returning a default on failure.
 */
export async function safeJson<T = Record<string, unknown>>(
  res: Response,
  fallback: T = {} as T
): Promise<T> {
  try {
    return await res.json();
  } catch {
    return fallback;
  }
}

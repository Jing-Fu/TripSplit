import { LineAuthError } from "./errors";

interface LineVerifyResponse {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
  error?: string;
  error_description?: string;
}

/**
 * Verify a LIFF ID Token by calling LINE's verify endpoint server-side.
 * Never decode JWT client-side — always call the LINE API.
 */
export async function verifyLiffIdToken(idToken: string): Promise<{
  lineUserId: string;
  name: string;
  picture?: string;
}> {
  const channelId = process.env.LIFF_CHANNEL_ID;
  if (!channelId) {
    throw new LineAuthError("verify_failed", "LIFF_CHANNEL_ID not configured");
  }

  let response: Response;
  try {
    response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new LineAuthError("verify_failed", `Failed to reach LINE verify endpoint: ${msg}`);
  }

  if (!response.ok) {
    throw new LineAuthError("verify_failed", `LINE verify returned ${response.status}`);
  }

  const data: LineVerifyResponse = await response.json();
  if (data.error) {
    if ((data.error_description ?? "").toLowerCase().includes("expired")) {
      throw new LineAuthError("expired", data.error_description ?? data.error);
    }
    throw new LineAuthError("verify_failed", data.error_description ?? data.error);
  }
  if (!data.sub) {
    throw new LineAuthError("verify_failed", "LINE verify response missing sub");
  }

  if (data.exp <= Math.floor(Date.now() / 1000)) {
    throw new LineAuthError("expired", "ID token has expired");
  }

  if (data.aud !== channelId) {
    throw new LineAuthError("audience_mismatch", `Expected aud=${channelId}, got ${data.aud}`);
  }

  return {
    lineUserId: data.sub,
    name: data.name ?? "",
    picture: data.picture,
  };
}

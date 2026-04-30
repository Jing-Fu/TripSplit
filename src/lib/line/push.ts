import { LinePushError } from "./errors";

export interface PushResult {
  delivered: boolean;
  reason?: "blocked" | "rate_limit" | "invalid";
}

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const MAX_RETRIES = 2;
const RETRY_DELAYS = [100, 200];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pushMessages(
  lineUserId: string,
  messages: object[]
): Promise<PushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new LinePushError("config_error", "LINE_CHANNEL_ACCESS_TOKEN not configured");
  }

  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    let response: Response;
    try {
      response = await fetch(LINE_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: lineUserId, messages }),
      });
    } catch {
      throw new LinePushError("network_error", "Failed to reach LINE push endpoint");
    }

    lastStatus = response.status;

    if (response.ok) {
      return { delivered: true };
    }

    // Blocked or unfriended — non-retryable
    if (response.status === 403) {
      return { delivered: false, reason: "blocked" };
    }

    // Rate limited — retry
    if (response.status === 429) {
      if (attempt === MAX_RETRIES) {
        return { delivered: false, reason: "rate_limit" };
      }
      continue;
    }

    // Other 4xx — non-retryable
    if (response.status >= 400 && response.status < 500) {
      return { delivered: false, reason: "invalid" };
    }

    // 5xx — retry
    if (attempt === MAX_RETRIES) {
      throw new LinePushError("server_error", `LINE push returned ${lastStatus} after ${MAX_RETRIES} retries`);
    }
  }

  throw new LinePushError("unknown", `Unexpected exit from retry loop, last status: ${lastStatus}`);
}

/**
 * Push a text message to a LINE user.
 * Returns { delivered: false, reason } instead of throwing for non-retryable failures.
 */
export async function pushText(lineUserId: string, text: string): Promise<PushResult> {
  return pushMessages(lineUserId, [{ type: "text", text }]);
}

/**
 * Push a flex message to a LINE user.
 */
export async function pushFlex(
  lineUserId: string,
  altText: string,
  contents: object
): Promise<PushResult> {
  return pushMessages(lineUserId, [{ type: "flex", altText, contents }]);
}

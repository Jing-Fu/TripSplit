import { createHmac } from 'crypto'

/**
 * 計算 LINE webhook 簽章（HMAC-SHA256，base64 encoded）
 * 用於測試中產生合法簽章
 */
export function signLineWebhook(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64')
}

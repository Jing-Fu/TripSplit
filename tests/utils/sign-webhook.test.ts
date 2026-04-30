import { describe, it, expect } from 'vitest'
import { signLineWebhook } from './sign-webhook'

describe('signLineWebhook', () => {
  it('produces consistent signature for same input', () => {
    const body = '{"test": "payload"}'
    const secret = 'test-channel-secret'
    const sig1 = signLineWebhook(body, secret)
    const sig2 = signLineWebhook(body, secret)
    expect(sig1).toBe(sig2)
    expect(typeof sig1).toBe('string')
    expect(sig1.length).toBeGreaterThan(0)
  })

  it('produces different signatures for different secrets', () => {
    const body = '{"test": "payload"}'
    const sig1 = signLineWebhook(body, 'secret-1')
    const sig2 = signLineWebhook(body, 'secret-2')
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different bodies', () => {
    const secret = 'test-secret'
    const sig1 = signLineWebhook('body-1', secret)
    const sig2 = signLineWebhook('body-2', secret)
    expect(sig1).not.toBe(sig2)
  })

  it('returns base64 encoded string', () => {
    const sig = signLineWebhook('test', 'secret')
    // base64 pattern
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})

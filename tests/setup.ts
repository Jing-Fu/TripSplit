import { vi } from 'vitest'

// Mock window.liff for all tests
const mockLiff = {
  init: vi.fn().mockResolvedValue(undefined),
  isInClient: vi.fn().mockReturnValue(false),
  isLoggedIn: vi.fn().mockReturnValue(false),
  getIDToken: vi.fn().mockReturnValue(null),
  getProfile: vi.fn().mockResolvedValue({
    userId: 'U_test_user_001',
    displayName: 'テストユーザー',
    pictureUrl: 'https://example.com/avatar.jpg',
  }),
  login: vi.fn(),
  logout: vi.fn(),
  getContext: vi.fn().mockReturnValue(null),
  ready: Promise.resolve(),
}

Object.defineProperty(globalThis, 'liff', {
  value: mockLiff,
  writable: true,
})

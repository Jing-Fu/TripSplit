import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockPrismaClient = vi.hoisted(() =>
  vi.fn(function MockPrismaClient() {
    return { __mock: 'PrismaClient' }
  }),
)

vi.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClient,
}))

describe('db singleton', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma
    mockPrismaClient.mockClear()
  })

  test('returns the same PrismaClient instance across imports', async () => {
    const first = await import('@/lib/db')

    vi.resetModules()

    const second = await import('@/lib/db')

    expect(first.db).toBe(second.db)
    expect(mockPrismaClient).toHaveBeenCalledTimes(1)
  })
})

import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'

const userModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'User')
const paymentMethodModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'PaymentMethod')
const expenseModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'Expense')
const backupRecordModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'BackupRecord')
const settlementReminderModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'SettlementReminder')

describe('prisma schema', () => {
  it('defines LINE user fields on User', () => {
    expect(userModel?.fields.some((field) => field.name === 'lineUserId' && field.type === 'String' && field.isUnique)).toBe(true)
    expect(userModel?.fields.some((field) => field.name === 'linePushEnabled' && field.type === 'Boolean')).toBe(true)
    expect(userModel?.fields.some((field) => field.name === 'googleSub')).toBe(false)
  })

  it('defines PaymentMethod model', () => {
    expect(paymentMethodModel).toBeDefined()
  })

  it('uses storageKey on BackupRecord', () => {
    expect(backupRecordModel?.fields.some((field) => field.name === 'storageKey')).toBe(true)
    expect(backupRecordModel?.fields.some((field) => field.name === 'filePath')).toBe(false)
  })

  it('stores receipt object keys instead of signed URLs on Expense', () => {
    expect(expenseModel?.fields.some((field) => field.name === 'receiptKey' && field.type === 'String')).toBe(true)
    expect(expenseModel?.fields.some((field) => field.name === 'receiptUrl')).toBe(false)
  })

  it('defines one settlement reminder per trip and user', () => {
    expect(settlementReminderModel).toBeDefined()
    expect(settlementReminderModel?.uniqueFields).toContainEqual(['tripId', 'userId'])
  })
})

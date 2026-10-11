import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyPendingRestore, backupName, isSqliteFile, msUntilNext } from '../src/backup.js'
import { openDb } from '../src/db/index.js'

const line = { itemId: 'cappuccino', title: 'Капучино', variant: '300 мл', addons: [], qty: 1, price: 290, category: 'coffee-milk' }
const order = { userId: 7, userName: 'Гость', lines: [line], total: 290, pickupAt: '12:15', comment: '', useFreeCoffee: false }

describe('расписание', () => {
  it('ждёт до ближайших 00:00 UTC', () => {
    expect(msUntilNext(0, Date.UTC(2026, 9, 11, 20, 0))).toBe(4 * 3600_000)
  })
  it('если час уже прошёл, ждёт до завтра', () => {
    expect(msUntilNext(3, Date.UTC(2026, 9, 11, 3, 0))).toBe(24 * 3600_000)
  })
  it('кривой час не превращается в NaN', () => {
    expect(msUntilNext(NaN, Date.UTC(2026, 9, 11, 20, 0))).toBe(4 * 3600_000)
  })
  it('имя файла с датой', () => {
    expect(backupName(new Date(Date.UTC(2026, 9, 11, 0, 0)))).toBe('ninebar-2026-10-11-00-00.db')
  })
})

describe('копия и восстановление', () => {
  it('копия содержит заказы, а восстановление подменяет базу', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ninebar-'))
    const file = join(dir, 'ninebar.db')
    const db = openDb(file)
    db.createOrder(order, 1)
    const copy = join(dir, 'copy.db')
    await db.backup(copy)
    expect(isSqliteFile(readFileSync(copy))).toBe(true)

    // после копии появился ещё заказ; восстановление должно вернуть состояние на момент копии
    db.createOrder(order, 1)
    expect(db.listOrders(7)).toHaveLength(2)
    db.close()

    writeFileSync(`${file}.restore`, readFileSync(copy))
    const restored = openDb(file)
    expect(existsSync(`${file}.restore`)).toBe(false)
    expect(restored.listOrders(7)).toHaveLength(1)
    expect(restored.getStamps(7)).toBe(1)
    restored.close()
  })
  it('без файла .restore ничего не трогает', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ninebar-'))
    expect(applyPendingRestore(join(dir, 'x.db'))).toBe(false)
  })
  it('чужой файл не считается базой', () => {
    expect(isSqliteFile(Buffer.from('%PDF-1.7 какой-то документ'))).toBe(false)
  })
})

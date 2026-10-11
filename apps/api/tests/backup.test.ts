import Database from 'better-sqlite3'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { openDb } from '../src/db/index.js'
import { makeBackup, msUntilNext } from '../src/lib/backup.js'

const base = { userId: 7, userName: 'Гость', lines: [], total: 250, pickupAt: '12:15', comment: '', useFreeCoffee: false }

describe('резервная копия', () => {
  it('содержит все заказы и штампы и открывается как база', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ninebar-test-'))
    const db = openDb(join(dir, 'live.db'))
    db.createOrder(base, 1)
    db.createOrder(base, 2)
    const { name, data } = await makeBackup(db, new Date('2026-10-12T00:00:00Z'))
    db.close()

    expect(name).toBe('ninebar-202610120000.db.gz')
    const restored = join(dir, 'restored.db')
    writeFileSync(restored, gunzipSync(data))
    const copy = new Database(restored, { readonly: true })
    expect((copy.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n).toBe(2)
    expect((copy.prepare('SELECT stamps FROM loyalty WHERE user_id = 7').get() as { stamps: number }).stamps).toBe(3)
    copy.close()
  })
})

describe('msUntilNext', () => {
  it('ждёт до ближайшей полуночи UTC', () => {
    expect(msUntilNext(0, new Date('2026-10-11T22:00:00Z'))).toBe(2 * 3600_000)
  })
  it('ровно в момент запуска переносит на следующие сутки', () => {
    expect(msUntilNext(0, new Date('2026-10-12T00:00:00Z'))).toBe(24 * 3600_000)
  })
})

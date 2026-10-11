import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { applyPendingRestore } from '../backup.js'

export interface OrderLine {
  itemId: string
  title: string
  variant: string
  addons: string[]
  qty: number
  price: number
  category: string
}

export interface OrderRow {
  id: number
  userId: number
  userName: string
  lines: OrderLine[]
  total: number
  pickupAt: string
  comment: string
  useFreeCoffee: boolean
  createdAt: string
}

export function openDb(file = process.env.DB_FILE ?? 'data/ninebar.db') {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true })
    if (applyPendingRestore(file)) console.log(`База восстановлена из копии: ${file}`)
  }
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      lines TEXT NOT NULL,
      total INTEGER NOT NULL,
      pickup_at TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      use_free INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loyalty (
      user_id INTEGER PRIMARY KEY,
      stamps INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  // Нумерация заказов с 101, чтобы бариста не путал с количеством
  db.exec(`INSERT OR IGNORE INTO sqlite_sequence(name, seq) VALUES ('orders', 100)`)

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, user_name, lines, total, pickup_at, comment, use_free, created_at)
    VALUES (@userId, @userName, @lines, @total, @pickupAt, @comment, @useFree, @createdAt)
  `)
  const selectOrders = db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
  const selectStamps = db.prepare(`SELECT stamps FROM loyalty WHERE user_id = ?`)
  const upsertStamps = db.prepare(`
    INSERT INTO loyalty (user_id, stamps) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET stamps = excluded.stamps
  `)
  const getSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`)
  const setSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)

  const rowToOrder = (r: any): OrderRow => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    lines: JSON.parse(r.lines),
    total: r.total,
    pickupAt: r.pickup_at,
    comment: r.comment,
    useFreeCoffee: !!r.use_free,
    createdAt: r.created_at,
  })

  return {
    getStamps(userId: number): number {
      return (selectStamps.get(userId) as { stamps: number } | undefined)?.stamps ?? 0
    },
    createOrder(o: Omit<OrderRow, 'id' | 'createdAt'>, stampsEarned: number): OrderRow {
      const tx = db.transaction(() => {
        const createdAt = new Date().toISOString()
        const res = insertOrder.run({
          userId: o.userId,
          userName: o.userName,
          lines: JSON.stringify(o.lines),
          total: o.total,
          pickupAt: o.pickupAt,
          comment: o.comment,
          useFree: o.useFreeCoffee ? 1 : 0,
          createdAt,
        })
        const prev = this.getStamps(o.userId)
        // бесплатный кофе закрывает круг (+1), потом начисляются новые штампы
        const next = o.useFreeCoffee ? prev + 1 + stampsEarned : prev + stampsEarned
        upsertStamps.run(o.userId, next)
        return { ...o, id: Number(res.lastInsertRowid), createdAt }
      })
      return tx()
    },
    listOrders(userId: number): OrderRow[] {
      return (selectOrders.all(userId) as any[]).map(rowToOrder)
    },
    getSetting(key: string): string | undefined {
      return (getSetting.get(key) as { value: string } | undefined)?.value
    },
    setSetting(key: string, value: string) {
      setSetting.run(key, value)
    },
    file,
    /** Целостная копия базы на ходу, заказы в это время не блокируются. */
    async backup(dest: string) {
      await db.backup(dest)
    },
    close() {
      db.close()
    },
  }
}

export type Db = ReturnType<typeof openDb>

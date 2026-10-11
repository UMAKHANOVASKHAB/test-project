import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { freeNow } from '../lib/pricing.js'

/** Бесплатный кофе ещё не накоплен (или уже потрачен параллельным заказом) */
export class FreeCoffeeError extends Error {}

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
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
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
  // Миграция для старой базы: ключ от повторной отправки одного и того же заказа
  const cols = db.prepare(`PRAGMA table_info(orders)`).all() as { name: string }[]
  if (!cols.some((c) => c.name === 'client_key')) db.exec(`ALTER TABLE orders ADD COLUMN client_key TEXT`)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS orders_client_key ON orders(client_key)`)
  // Нумерация заказов с 101, чтобы бариста не путал с количеством
  db.exec(`INSERT OR IGNORE INTO sqlite_sequence(name, seq) VALUES ('orders', 100)`)

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, user_name, lines, total, pickup_at, comment, use_free, created_at, client_key)
    VALUES (@userId, @userName, @lines, @total, @pickupAt, @comment, @useFree, @createdAt, @clientKey)
  `)
  const selectOrders = db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
  const selectByKey = db.prepare(`SELECT * FROM orders WHERE client_key = ?`)
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
    /**
     * Заказ и штампы пишутся одной транзакцией: либо всё, либо ничего.
     * Повтор с тем же clientKey (двойное нажатие, повтор после обрыва сети) возвращает
     * уже созданный заказ, а не второй.
     */
    createOrder(
      o: Omit<OrderRow, 'id' | 'createdAt'>,
      stampsEarned: number,
      opts: { stampsForFree?: number; clientKey?: string } = {},
    ): OrderRow & { duplicate?: boolean } {
      const tx = db.transaction(() => {
        if (opts.clientKey) {
          const existing = selectByKey.get(opts.clientKey)
          // ключ чужого заказа не выдаёт его содержимое
          if (existing && (existing as { user_id: number }).user_id === o.userId) return { ...rowToOrder(existing), duplicate: true }
          if (existing) throw new Error('client key reused')
        }
        const prev = this.getStamps(o.userId)
        if (o.useFreeCoffee && (!o.userId || !freeNow(prev, opts.stampsForFree ?? 6))) throw new FreeCoffeeError()
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
          clientKey: opts.clientKey ?? null,
        })
        // штамп = купленный кофе, бесплатный тоже: 6-й кофе закрывает круг ровно до 0
        if (o.userId) upsertStamps.run(o.userId, prev + stampsEarned)
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
    /** Целостная копия базы в файл, можно делать на ходу, не останавливая сервер */
    backupTo(file: string) {
      return db.backup(file)
    },
    close() {
      db.close()
    },
  }
}

export type Db = ReturnType<typeof openDb>

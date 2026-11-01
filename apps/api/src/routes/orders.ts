import { Router } from 'express'
import type { Db } from '../db/index.js'
import type { TgUser } from '../auth.js'
import { checkPickup } from '../hours.js'
import { priceOrder, type Menu } from '../pricing.js'

export interface Notifier {
  notifyOrder(o: any): Promise<boolean>
  notifyGuest(o: any): Promise<void>
}

/** Проверяет то, что заказ не может посчитать сервер: время и комментарий. */
export function validateOrder(body: any): { ok: true; pickupAt: string; comment: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.pickupAt ?? '')) return { ok: false, error: 'bad pickup time' }
  return { ok: true, pickupAt: body.pickupAt, comment: String(body.comment ?? '').slice(0, 300) }
}

export interface RouterOptions {
  /** часы для проверки времени самовывоза, в тестах подменяются */
  now?: () => Date
  /** не больше max новых заказов за windowMs от одного гостя */
  rateLimit?: { max: number; windowMs: number }
}

/** Счётчик заказов в памяти: после перезапуска обнуляется, для одной кофейни этого хватает. */
function createLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const hits = new Map<number, number[]>()
  return {
    allowed(userId: number, now: number) {
      const recent = (hits.get(userId) ?? []).filter((t) => now - t < windowMs)
      hits.set(userId, recent)
      return recent.length < max
    },
    record(userId: number, now: number) {
      const list = hits.get(userId) ?? []
      list.push(now)
      hits.set(userId, list)
    },
  }
}

export function ordersRouter(db: Db, notifier: Notifier, menu: Menu, opts: RouterOptions = {}) {
  const r = Router()
  const now = opts.now ?? (() => new Date())
  const limiter = createLimiter(opts.rateLimit ?? { max: 5, windowMs: 10 * 60_000 })
  const timeZone = menu.shop.timezone ?? 'Europe/Moscow'

  r.post('/api/orders', async (req, res) => {
    // Express 4 не ловит ошибки в async-обработчиках: без try/catch сбой базы уронил бы весь сервер
    try {
      const user: TgUser = res.locals.user
      // без подписи Telegram любой мог бы засыпать бариста фальшивыми заказами через curl
      if (!user.id) return res.status(401).json({ error: 'open in telegram' })
      const v = validateOrder(req.body)
      if (!v.ok) return res.status(400).json({ error: v.error })
      // повтор того же заказа (двойное нажатие): отдаём уже созданный, бариста второй раз не уведомляем
      const key = typeof req.body.clientKey === 'string' && /^[\w-]{8,64}$/.test(req.body.clientKey) ? req.body.clientKey : null
      const existing = key ? db.findByKey(user.id, key) : undefined
      if (existing) return res.json(existing)
      const at = now()
      const pickup = checkPickup(v.pickupAt, menu.shop.hours, timeZone, at)
      if (pickup !== 'ok') return res.status(400).json({ error: pickup === 'past' ? 'pickup time passed' : 'shop closed' })
      if (!limiter.allowed(user.id, at.getTime())) return res.status(429).json({ error: 'too many orders' })
      const stamps = db.getStamps(user.id)
      // штампы списываются при выдаче, поэтому второй бесплатный до выдачи первого не даём
      const wantFree = !!req.body.useFreeCoffee
      if (wantFree && db.hasPendingFree(user.id)) return res.status(400).json({ error: 'free coffee not available' })
      const p = priceOrder(menu, req.body.lines, wantFree, stamps)
      if (!p.ok) return res.status(400).json({ error: p.error })
      const order = db.createOrder(
        { userId: user.id, userName: user.name, lines: p.order.lines, total: p.order.total, pickupAt: v.pickupAt, comment: v.comment, useFreeCoffee: p.order.useFreeCoffee },
        p.order.stampsEarned,
        key,
      )
      limiter.record(user.id, at.getTime())
      // уведомления не должны ломать ответ гостю
      notifier.notifyOrder(order).catch((e) => console.error('notifyOrder', e))
      notifier.notifyGuest(order).catch(() => {})
      res.json(order)
    } catch (e) {
      console.error('POST /api/orders', e)
      res.status(500).json({ error: 'server error' })
    }
  })

  // только свои заказы и штампы: пользователь берётся из подписи Telegram, а не из адреса
  r.get('/api/orders', (_req, res) => {
    const user: TgUser = res.locals.user
    res.json(user.id ? db.listOrders(user.id) : [])
  })

  r.get('/api/loyalty', (_req, res) => {
    const user: TgUser = res.locals.user
    res.json({ stamps: user.id ? db.getStamps(user.id) : 0 })
  })

  return r
}

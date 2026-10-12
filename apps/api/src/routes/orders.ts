import { Router } from 'express'
import type { Db } from '../db/index.js'
import type { TgUser } from '../auth.js'
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

export function ordersRouter(db: Db, notifier: Notifier, menu: Menu) {
  const r = Router()

  r.post('/api/orders', async (req, res) => {
    const user: TgUser = res.locals.user
    // без подписи Telegram любой мог бы засыпать бариста фальшивыми заказами через curl
    if (!user.id) return res.status(401).json({ error: 'open in telegram' })
    const v = validateOrder(req.body)
    if (!v.ok) return res.status(400).json({ error: v.error })
    const stamps = db.getStamps(user.id)
    const p = priceOrder(menu, req.body.lines, !!req.body.useFreeCoffee, stamps)
    if (!p.ok) return res.status(400).json({ error: p.error })
    const order = db.createOrder(
      { userId: user.id, userName: user.name, lines: p.order.lines, total: p.order.total, pickupAt: v.pickupAt, comment: v.comment, useFreeCoffee: p.order.useFreeCoffee },
      p.order.stampsEarned,
    )
    // уведомления не должны ломать ответ гостю
    notifier.notifyOrder(order).catch((e) => console.error('notifyOrder', e))
    notifier.notifyGuest(order).catch(() => {})
    res.json(order)
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

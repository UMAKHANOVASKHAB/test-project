import { Router } from 'express'
import type { Db, OrderLine } from '../db/index.js'

export interface Notifier {
  notifyOrder(o: any): Promise<boolean>
  notifyGuest(o: any): Promise<void>
}

export function validateOrder(body: any): { ok: true; order: any; stampsEarned: number } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' }
  const lines = body.lines
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: 'empty order' }
  for (const l of lines as OrderLine[]) {
    if (!l.title || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) return { ok: false, error: 'bad line' }
    if (!Number.isFinite(l.price) || l.price < 0) return { ok: false, error: 'bad price' }
  }
  if (!/^\d{2}:\d{2}$/.test(body.pickupAt ?? '')) return { ok: false, error: 'bad pickup time' }
  if (!Number.isFinite(body.total) || body.total < 0) return { ok: false, error: 'bad total' }
  const stampsEarned = Number.isInteger(body.stampsEarned) ? Math.max(0, Math.min(20, body.stampsEarned)) : 0
  return {
    ok: true,
    stampsEarned,
    order: {
      userId: Number(body.userId) || 0,
      userName: String(body.userName ?? 'Гость').slice(0, 80),
      lines: lines.map((l: OrderLine) => ({
        itemId: String(l.itemId ?? ''),
        title: String(l.title).slice(0, 80),
        variant: String(l.variant ?? '').slice(0, 40),
        addons: Array.isArray(l.addons) ? l.addons.map(String).slice(0, 5) : [],
        qty: l.qty,
        price: Math.round(l.price),
        category: String(l.category ?? ''),
      })),
      total: Math.round(body.total),
      pickupAt: body.pickupAt,
      comment: String(body.comment ?? '').slice(0, 300),
      useFreeCoffee: !!body.useFreeCoffee,
    },
  }
}

export function ordersRouter(db: Db, notifier: Notifier) {
  const r = Router()

  r.post('/api/orders', async (req, res) => {
    const v = validateOrder(req.body)
    if (!v.ok) return res.status(400).json({ error: v.error })
    const order = db.createOrder(v.order, v.stampsEarned)
    // уведомления не должны ломать ответ гостю
    notifier.notifyOrder(order).catch((e) => console.error('notifyOrder', e))
    notifier.notifyGuest(order).catch(() => {})
    res.json(order)
  })

  r.get('/api/orders', (req, res) => {
    const userId = Number(req.query.userId) || 0
    res.json(db.listOrders(userId))
  })

  r.get('/api/loyalty/:userId', (req, res) => {
    res.json({ stamps: db.getStamps(Number(req.params.userId) || 0) })
  })

  return r
}

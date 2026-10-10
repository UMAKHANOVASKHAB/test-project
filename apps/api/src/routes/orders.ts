import { Router, type Request } from 'express'
import { FreeCoffeeError, type Db, type OrderRow } from '../db/index.js'
import { priceOrder, type MenuData } from '../lib/pricing.js'
import { verifyInitData, type TgUser } from '../lib/telegramAuth.js'

export interface Notifier {
  notifyOrder(o: OrderRow): Promise<boolean>
  notifyGuest(o: OrderRow): Promise<void>
}

export function validateOrder(body: any, menu: MenuData) {
  if (!body || typeof body !== 'object') return { ok: false as const, error: 'bad body' }
  if (!/^\d{2}:\d{2}$/.test(body.pickupAt ?? '')) return { ok: false as const, error: 'bad pickup time' }
  const clientKey = body.clientKey === undefined ? undefined : String(body.clientKey)
  if (clientKey !== undefined && !/^[A-Za-z0-9-]{8,64}$/.test(clientKey)) return { ok: false as const, error: 'bad client key' }
  const priced = priceOrder(menu, body.lines, !!body.useFreeCoffee)
  if (!priced.ok) return priced
  return {
    ok: true as const,
    clientKey,
    stampsEarned: priced.stampsEarned,
    lines: priced.lines,
    total: priced.total,
    pickupAt: body.pickupAt as string,
    comment: String(body.comment ?? '').slice(0, 300),
    useFreeCoffee: !!body.useFreeCoffee,
    userName: String(body.userName ?? 'Гость').slice(0, 80),
  }
}

/**
 * Кто делает запрос. Внутри Telegram мини-апп шлёт заголовок `Authorization: tma <initData>`,
 * сервер проверяет подпись. Без заголовка это гость из браузера (id 0): заказать можно,
 * штампов и истории нет. Поддельная подпись отклоняется.
 */
function whoIs(req: Request, botToken: string): TgUser | 'guest' | 'forged' {
  const auth = req.get('authorization') ?? ''
  if (!auth.startsWith('tma ')) return 'guest'
  if (!botToken) return 'guest' // без токена проверить нечем, считаем гостем
  return verifyInitData(auth.slice(4), botToken) ?? 'forged'
}

export function ordersRouter(db: Db, notifier: Notifier, menu: MenuData, botToken: string) {
  const r = Router()

  r.post('/api/orders', (req, res) => {
    const who = whoIs(req, botToken)
    if (who === 'forged') return res.status(401).json({ error: 'bad telegram auth' })
    const v = validateOrder(req.body, menu)
    if (!v.ok) return res.status(400).json({ error: v.error })
    const user = who === 'guest' ? { id: 0, name: v.userName } : who
    let order: OrderRow & { duplicate?: boolean }
    try {
      order = db.createOrder(
        { userId: user.id, userName: user.name, lines: v.lines, total: v.total, pickupAt: v.pickupAt, comment: v.comment, useFreeCoffee: v.useFreeCoffee },
        v.stampsEarned,
        { stampsForFree: menu.shop.loyalty.stampsForFree, clientKey: v.clientKey },
      )
    } catch (e) {
      if (e instanceof FreeCoffeeError) return res.status(409).json({ error: 'free coffee not available' })
      throw e
    }
    const { duplicate, ...saved } = order
    // повтор того же заказа: бариста уже получил его, второй раз не шлём
    if (!duplicate) {
      notifier.notifyOrder(saved).catch((e) => console.error('notifyOrder', e))
      notifier.notifyGuest(saved).catch(() => {})
    }
    res.json(saved)
  })

  // История и штампы только свои: id берётся из подписи, а не из адреса
  r.get('/api/orders', (req, res) => {
    const who = whoIs(req, botToken)
    if (who === 'forged') return res.status(401).json({ error: 'bad telegram auth' })
    res.json(who === 'guest' ? [] : db.listOrders(who.id))
  })

  r.get('/api/loyalty', (req, res) => {
    const who = whoIs(req, botToken)
    if (who === 'forged') return res.status(401).json({ error: 'bad telegram auth' })
    res.json({ stamps: who === 'guest' ? 0 : db.getStamps(who.id) })
  })

  return r
}

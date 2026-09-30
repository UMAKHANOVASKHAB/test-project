import { createHmac } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { afterEach, describe, expect, it } from 'vitest'
import { telegramAuth, verifyInitData } from '../src/auth.js'
import { openDb } from '../src/db/index.js'
import { loadMenu, priceOrder } from '../src/pricing.js'
import { ordersRouter, validateOrder } from '../src/routes/orders.js'

const menu = loadMenu('../web/src/data/menu.json')
const TOKEN = '123456:TEST_TOKEN_FOR_TESTS_ONLY_abcdefghijk'

/** Подписывает initData так же, как это делает Telegram */
function signInitData(user: object, token = TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify(user) })
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'))
  return params.toString()
}

const capp = { itemId: 'cappuccino', variant: '300 мл', addons: ['Сироп'], qty: 1 }

describe('verifyInitData', () => {
  it('принимает подпись Telegram', () => {
    expect(verifyInitData(signInitData({ id: 42, first_name: 'Асхаб' }), TOKEN)).toEqual({ id: 42, name: 'Асхаб' })
  })
  it('отклоняет подпись другим токеном', () => {
    expect(verifyInitData(signInitData({ id: 42 }, '999:OTHER'), TOKEN)).toBeNull()
  })
  it('отклоняет подменённого пользователя', () => {
    const forged = signInitData({ id: 42 }).replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":43'))
    expect(verifyInitData(forged, TOKEN)).toBeNull()
  })
  it('отклоняет устаревшие данные', () => {
    expect(verifyInitData(signInitData({ id: 42 }, TOKEN, Math.floor(Date.now() / 1000) - 3 * 86400), TOKEN)).toBeNull()
  })
})

describe('priceOrder', () => {
  it('берёт цены из меню, а не из запроса', () => {
    const p = priceOrder(menu, [{ ...capp, price: 0, title: 'Бесплатно' }], false, 0)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const item = menu.items.find((i) => i.id === 'cappuccino')!
    const syrup = menu.addons.find((a) => a.id === 'syrup')!
    expect(p.order.lines[0].price).toBe(item.variants.find((v) => v.label === '300 мл')!.price + syrup.price)
    expect(p.order.lines[0].title).toBe(item.title)
    expect(p.order.total).toBe(p.order.lines[0].price)
    expect(p.order.stampsEarned).toBe(1)
  })
  it('отклоняет неизвестную позицию и добавку не из той категории', () => {
    expect(priceOrder(menu, [{ itemId: 'nope', variant: '', qty: 1 }], false, 0).ok).toBe(false)
    expect(priceOrder(menu, [{ ...capp, addons: ['Добавка к чаю'] }], false, 0).ok).toBe(false)
  })
  it('бесплатный кофе только когда он положен', () => {
    expect(priceOrder(menu, [capp], true, 0).ok).toBe(false)
    const p = priceOrder(menu, [capp], true, 5)
    expect(p.ok && p.order.stampsEarned).toBe(0)
  })
})

describe('validateOrder', () => {
  it('отклоняет кривое время', () => {
    expect(validateOrder({ pickupAt: 'скоро' }).ok).toBe(false)
    expect(validateOrder({ pickupAt: '12:15' }).ok).toBe(true)
  })
})

describe('db', () => {
  it('создаёт заказ с номером от 101 и начисляет штампы', () => {
    const db = openDb(':memory:')
    const o = db.createOrder({ userId: 7, userName: 'Гость', lines: [], total: 290, pickupAt: '12:15', comment: '', useFreeCoffee: false }, 1)
    expect(o.id).toBe(101)
    expect(db.getStamps(7)).toBe(1)
    db.close()
  })
})

describe('API /api/orders', () => {
  let close = () => {}
  afterEach(() => close())

  async function start() {
    const db = openDb(':memory:')
    const app = express()
    app.use(express.json())
    app.use('/api', telegramAuth(TOKEN))
    app.use(ordersRouter(db, { notifyOrder: async () => true, notifyGuest: async () => {} }, menu))
    const server = app.listen(0)
    close = () => { server.close(); db.close() }
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const call = (path: string, init: { body?: object; auth?: string } = {}) =>
      fetch(base + path, {
        method: init.body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...(init.auth ? { Authorization: `tma ${init.auth}` } : {}) },
        body: init.body ? JSON.stringify(init.body) : undefined,
      })
    return { db, call }
  }

  it('штампы и пользователь берутся из подписи, а не из тела запроса', async () => {
    const { db, call } = await start()
    const auth = signInitData({ id: 42, first_name: 'Асхаб' })
    const r = await call('/api/orders', { auth, body: { userId: 1, stampsEarned: 20, total: 0, lines: [capp], pickupAt: '12:15' } })
    expect(r.status).toBe(200)
    const o = await r.json()
    expect(o.userId).toBe(42)
    expect(o.total).toBeGreaterThan(0)
    expect(db.getStamps(42)).toBe(1)
    expect(db.getStamps(1)).toBe(0)
  })

  it('чужие заказы не видны, поддельная подпись отклоняется', async () => {
    const { call } = await start()
    const auth = signInitData({ id: 42 })
    await call('/api/orders', { auth, body: { lines: [capp], pickupAt: '12:15' } })
    expect(await (await call('/api/orders', { auth })).json()).toHaveLength(1)
    expect(await (await call('/api/orders?userId=42')).json()).toHaveLength(0)
    expect((await call('/api/orders', { auth: 'hash=00' })).status).toBe(401)
  })

  it('гость без Telegram может заказать, но штампы не копит', async () => {
    const { db, call } = await start()
    const r = await call('/api/orders', { body: { lines: [capp], pickupAt: '12:15', useFreeCoffee: true } })
    const o = await r.json()
    expect(o.userId).toBe(0)
    expect(o.useFreeCoffee).toBe(false)
    expect(db.getStamps(0)).toBe(0)
  })
})

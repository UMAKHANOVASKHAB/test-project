import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { FreeCoffeeError, openDb } from '../src/db/index.js'
import { loadMenu, priceOrder } from '../src/lib/pricing.js'
import { verifyInitData } from '../src/lib/telegramAuth.js'
import { validateOrder } from '../src/routes/orders.js'

const menu = loadMenu()
// клиент присылает только выбор; цену сервер берёт из menu.json
const line = { itemId: 'cappuccino', variant: '300 мл', addons: ['Сироп'], qty: 1 }
const cappuccino300 = menu.items.find((i) => i.id === 'cappuccino')!.variants.find((v) => v.label === '300 мл')!.price
const syrup = menu.addons.find((a) => a.id === 'syrup')!.price
const base = { userId: 7, userName: 'Гость', lines: [], total: 0, pickupAt: '12:15', comment: '', useFreeCoffee: false }

describe('validateOrder', () => {
  it('считает цену по меню, а не по присланной', () => {
    const v = validateOrder({ lines: [{ ...line, price: 1, qty: 2 }], total: 1, pickupAt: '12:15' }, menu)
    expect(v.ok && v.total).toBe((cappuccino300 + syrup) * 2)
    expect(v.ok && v.stampsEarned).toBe(2)
  })
  it('отклоняет пустой заказ', () => {
    expect(validateOrder({ lines: [], pickupAt: '12:00' }, menu).ok).toBe(false)
  })
  it('отклоняет кривое время', () => {
    expect(validateOrder({ lines: [line], pickupAt: 'скоро' }, menu).ok).toBe(false)
  })
  it('отклоняет неизвестные позиции, размеры и добавки', () => {
    expect(validateOrder({ lines: [{ ...line, itemId: 'free-money' }], pickupAt: '12:00' }, menu).ok).toBe(false)
    expect(validateOrder({ lines: [{ ...line, variant: '5 л' }], pickupAt: '12:00' }, menu).ok).toBe(false)
    expect(validateOrder({ lines: [{ ...line, addons: ['Золото'] }], pickupAt: '12:00' }, menu).ok).toBe(false)
    expect(validateOrder({ lines: [{ ...line, qty: 0 }], pickupAt: '12:00' }, menu).ok).toBe(false)
  })
})

describe('priceOrder: бесплатный кофе', () => {
  it('скидка равна цене самого дешёвого кофе без добавок', () => {
    const p = priceOrder(menu, [line], true)
    expect(p.ok && p.discount).toBe(cappuccino300)
    expect(p.ok && p.total).toBe(syrup)
  })
})

describe('db', () => {
  it('создаёт заказ с номером от 101 и начисляет штампы', () => {
    const db = openDb(':memory:')
    const o = db.createOrder({ ...base, total: 290 }, 1)
    expect(o.id).toBe(101)
    expect(db.getStamps(7)).toBe(1)
    expect(db.listOrders(7)).toHaveLength(1)
    db.close()
  })
  it('6-й кофе бесплатный и круг закрывается ровно до нуля', () => {
    const db = openDb(':memory:')
    for (let i = 0; i < 5; i++) db.createOrder(base, 1)
    db.createOrder({ ...base, useFreeCoffee: true }, 1)
    expect(db.getStamps(7) % 6).toBe(0)
    // следующий бесплатный только через 5 оплаченных, не через 4
    for (let i = 0; i < 4; i++) db.createOrder(base, 1)
    expect(() => db.createOrder({ ...base, useFreeCoffee: true }, 1)).toThrow(FreeCoffeeError)
    db.close()
  })
  it('бесплатный кофе нельзя взять раньше времени или гостю', () => {
    const db = openDb(':memory:')
    expect(() => db.createOrder({ ...base, useFreeCoffee: true }, 1)).toThrow(FreeCoffeeError)
    expect(() => db.createOrder({ ...base, userId: 0, useFreeCoffee: true }, 1)).toThrow(FreeCoffeeError)
    db.close()
  })
  it('повтор с тем же ключом не создаёт второй заказ и второй штамп', () => {
    const db = openDb(':memory:')
    const a = db.createOrder(base, 1, { clientKey: 'abc12345' })
    const b = db.createOrder(base, 1, { clientKey: 'abc12345' })
    expect(b.id).toBe(a.id)
    expect(b.duplicate).toBe(true)
    expect(db.getStamps(7)).toBe(1)
    expect(db.listOrders(7)).toHaveLength(1)
    db.close()
  })
  it('гостю (id 0) штампы не копятся', () => {
    const db = openDb(':memory:')
    db.createOrder({ ...base, userId: 0 }, 3)
    expect(db.getStamps(0)).toBe(0)
    db.close()
  })
})

describe('verifyInitData', () => {
  const token = '123456:TEST_TOKEN_abcdefghijklmnopqrstuvwxyz'
  const sign = (fields: Record<string, string>, tok = token) => {
    const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n')
    const secret = createHmac('sha256', 'WebAppData').update(tok).digest()
    const hash = createHmac('sha256', secret).update(dcs).digest('hex')
    return new URLSearchParams({ ...fields, hash }).toString()
  }
  const now = 1_800_000_000_000
  const fields = { auth_date: String(now / 1000 - 60), query_id: 'Q1', user: JSON.stringify({ id: 42, first_name: 'Али' }) }

  it('принимает подпись Telegram и отдаёт пользователя', () => {
    expect(verifyInitData(sign(fields), token, 86400, now)).toEqual({ id: 42, name: 'Али' })
  })
  it('отклоняет подмену пользователя', () => {
    const forged = sign(fields).replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":43'))
    expect(verifyInitData(forged, token, 86400, now)).toBeNull()
  })
  it('отклоняет подпись чужим токеном и старые данные', () => {
    expect(verifyInitData(sign(fields, '1:other'), token, 86400, now)).toBeNull()
    expect(verifyInitData(sign({ ...fields, auth_date: String(now / 1000 - 90000) }), token, 86400, now)).toBeNull()
    expect(verifyInitData('user=1', token, 86400, now)).toBeNull()
  })
})

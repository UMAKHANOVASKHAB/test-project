import { describe, expect, it } from 'vitest'
import { openDb } from '../src/db/index.js'
import { validateOrder } from '../src/routes/orders.js'

const line = { itemId: 'cappuccino', title: 'Капучино', variant: '300 мл', addons: ['Сироп'], qty: 1, price: 290, category: 'coffee-milk' }

describe('validateOrder', () => {
  it('принимает корректный заказ', () => {
    const v = validateOrder({ userId: 1, userName: 'Асхаб', lines: [line], total: 290, pickupAt: '12:15', stampsEarned: 1 })
    expect(v.ok).toBe(true)
  })
  it('отклоняет пустой заказ', () => {
    expect(validateOrder({ lines: [], total: 0, pickupAt: '12:00' }).ok).toBe(false)
  })
  it('отклоняет кривое время', () => {
    expect(validateOrder({ lines: [line], total: 290, pickupAt: 'скоро' }).ok).toBe(false)
  })
  it('ограничивает штампы разумным числом', () => {
    const v = validateOrder({ lines: [line], total: 290, pickupAt: '12:00', stampsEarned: 999 })
    expect(v.ok && v.stampsEarned).toBe(20)
  })
})

describe('db', () => {
  it('создаёт заказ с номером от 101 и начисляет штампы', () => {
    const db = openDb(':memory:')
    const o = db.createOrder({ userId: 7, userName: 'Гость', lines: [line], total: 290, pickupAt: '12:15', comment: '', useFreeCoffee: false }, 1)
    expect(o.id).toBe(101)
    expect(db.getStamps(7)).toBe(1)
    expect(db.listOrders(7)).toHaveLength(1)
    db.close()
  })
  it('бесплатный кофе закрывает круг', () => {
    const db = openDb(':memory:')
    for (let i = 0; i < 5; i++) db.createOrder({ userId: 7, userName: 'Гость', lines: [line], total: 290, pickupAt: '12:15', comment: '', useFreeCoffee: false }, 1)
    expect(db.getStamps(7)).toBe(5)
    db.createOrder({ userId: 7, userName: 'Гость', lines: [line], total: 0, pickupAt: '12:30', comment: '', useFreeCoffee: true }, 0)
    expect(db.getStamps(7) % 6).toBe(0)
    db.close()
  })
})

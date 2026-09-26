import { describe, expect, it } from 'vitest'
import { loyaltyState, stampsForOrder } from './loyalty'

describe('loyaltyState (каждый 6-й бесплатно)', () => {
  it('0 покупок: пусто, осталось 5', () => {
    expect(loyaltyState(0, 6)).toEqual({ filled: 0, total: 6, freeNow: false, left: 5 })
  })
  it('1 покупка: один кружок', () => {
    expect(loyaltyState(1, 6).filled).toBe(1)
  })
  it('5 покупок: следующий бесплатно', () => {
    const s = loyaltyState(5, 6)
    expect(s.freeNow).toBe(true)
    expect(s.left).toBe(0)
  })
  it('6 покупок: карта обнулилась', () => {
    expect(loyaltyState(6, 6)).toEqual({ filled: 0, total: 6, freeNow: false, left: 5 })
  })
  it('11 покупок: снова бесплатный', () => {
    expect(loyaltyState(11, 6).freeNow).toBe(true)
  })
})

describe('stampsForOrder', () => {
  const coffee = ['coffee-milk', 'coffee-raf']
  it('считает только кофейные категории, по количеству', () => {
    const n = stampsForOrder(
      [
        { category: 'coffee-milk', qty: 2 },
        { category: 'breakfast', qty: 1 },
        { category: 'coffee-raf', qty: 1 },
      ],
      coffee,
    )
    expect(n).toBe(3)
  })
  it('без кофе штампов нет', () => {
    expect(stampsForOrder([{ category: 'salads', qty: 3 }], coffee)).toBe(0)
  })
})

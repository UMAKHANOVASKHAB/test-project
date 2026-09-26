import { describe, expect, it } from 'vitest'
import { cartCount, cartReducer, cartTotal, emptyCart, lineKey } from './cart'
import type { Addon, MenuItem } from '../types/menu'

const cappuccino: MenuItem = {
  id: 'cappuccino',
  category: 'coffee-milk',
  title: 'Капучино',
  variants: [
    { label: '200 мл', price: 200 },
    { label: '300 мл', price: 250 },
  ],
}
const syrup: Addon = { id: 'syrup', title: 'Сироп', price: 40, forCategories: ['coffee-milk'] }

describe('cartReducer', () => {
  it('добавляет позицию и считает сумму', () => {
    const s = cartReducer(emptyCart, { type: 'add', item: cappuccino, variant: cappuccino.variants[1] })
    expect(s.lines).toHaveLength(1)
    expect(cartTotal(s)).toBe(250)
  })

  it('та же позиция и вариант увеличивают количество, а не строки', () => {
    let s = cartReducer(emptyCart, { type: 'add', item: cappuccino, variant: cappuccino.variants[0] })
    s = cartReducer(s, { type: 'add', item: cappuccino, variant: cappuccino.variants[0] })
    expect(s.lines).toHaveLength(1)
    expect(cartCount(s)).toBe(2)
    expect(cartTotal(s)).toBe(400)
  })

  it('разные размеры это разные строки', () => {
    let s = cartReducer(emptyCart, { type: 'add', item: cappuccino, variant: cappuccino.variants[0] })
    s = cartReducer(s, { type: 'add', item: cappuccino, variant: cappuccino.variants[1] })
    expect(s.lines).toHaveLength(2)
  })

  it('добавка входит в цену строки', () => {
    const s = cartReducer(emptyCart, { type: 'add', item: cappuccino, variant: cappuccino.variants[1], addons: [syrup] })
    expect(cartTotal(s)).toBe(290)
  })

  it('dec до нуля удаляет строку', () => {
    let s = cartReducer(emptyCart, { type: 'add', item: cappuccino, variant: cappuccino.variants[0] })
    const key = lineKey(cappuccino, cappuccino.variants[0], [])
    s = cartReducer(s, { type: 'dec', key })
    expect(s.lines).toHaveLength(0)
  })
})

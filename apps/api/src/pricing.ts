import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { OrderLine } from './db/index.js'

interface Variant { label: string; price: number }
interface MenuItem { id: string; category: string; title: string; variants: Variant[] }
interface Addon { id: string; title: string; price: number; forCategories: string[] }
export interface Menu {
  shop: {
    loyalty: { stampsForFree: number; countsCategories: string[] }
    hours: { open: string; close: string }
    timezone?: string
  }
  addons: Addon[]
  items: MenuItem[]
}

// Меню одно на мини-апп и сервер: цены берём отсюда, а не из запроса
export function loadMenu(file = process.env.MENU_FILE ?? '../web/src/data/menu.json'): Menu {
  return JSON.parse(readFileSync(resolve(file), 'utf8')) as Menu
}

export interface PricedOrder {
  lines: OrderLine[]
  total: number
  /** штампы за этот заказ, бесплатный напиток штамп не даёт */
  stampsEarned: number
  useFreeCoffee: boolean
}

/**
 * Пересчитывает заказ по меню. От клиента берём только что заказали (id, объём, добавки, количество),
 * названия, категории, цены, сумму и штампы считает сервер.
 */
export function priceOrder(menu: Menu, rawLines: unknown, wantFree: boolean, stamps: number): { ok: true; order: PricedOrder } | { ok: false; error: string } {
  if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 30) return { ok: false, error: 'empty order' }
  const { stampsForFree, countsCategories } = menu.shop.loyalty
  const lines: OrderLine[] = []
  for (const l of rawLines as any[]) {
    const item = menu.items.find((i) => i.id === l?.itemId)
    if (!item) return { ok: false, error: 'unknown item' }
    const variant = item.variants.find((v) => v.label === (l.variant ?? '')) ?? (item.variants.length === 1 ? item.variants[0] : undefined)
    if (!variant) return { ok: false, error: 'unknown variant' }
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) return { ok: false, error: 'bad line' }
    const wanted: unknown[] = Array.isArray(l.addons) ? l.addons.slice(0, 5) : []
    const addons: Addon[] = []
    for (const w of wanted) {
      const a = menu.addons.find((x) => (x.id === w || x.title === w) && x.forCategories.includes(item.category))
      if (!a) return { ok: false, error: 'unknown addon' }
      if (!addons.includes(a)) addons.push(a)
    }
    lines.push({
      itemId: item.id,
      title: item.title,
      variant: variant.label,
      addons: addons.map((a) => a.title),
      qty: l.qty,
      price: (variant.price + addons.reduce((s, a) => s + a.price, 0)) * l.qty,
      category: item.category,
    })
  }

  const coffee = lines.filter((l) => countsCategories.includes(l.category))
  const coffeeQty = coffee.reduce((s, l) => s + l.qty, 0)
  const freeNow = stamps % stampsForFree === stampsForFree - 1
  if (wantFree && !(freeNow && coffee.length > 0)) return { ok: false, error: 'free coffee not available' }

  // бесплатный: самый дешёвый кофейный напиток по базовой цене, как показывает мини-апп
  const discount = wantFree
    ? Math.min(...coffee.map((l) => menu.items.find((i) => i.id === l.itemId)!.variants.find((v) => v.label === l.variant)!.price))
    : 0
  const total = lines.reduce((s, l) => s + l.price, 0) - discount
  return {
    ok: true,
    order: { lines, total, stampsEarned: wantFree ? coffeeQty - 1 : coffeeQty, useFreeCoffee: wantFree },
  }
}

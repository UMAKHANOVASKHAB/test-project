import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { OrderLine } from '../db/index.js'

export interface MenuData {
  shop: { loyalty: { stampsForFree: number; countsCategories: string[] } }
  addons: { id: string; title: string; price: number; forCategories: string[] }[]
  items: { id: string; category: string; title: string; variants: { label: string; price: number }[] }[]
}

// Тот же menu.json, из которого собирается мини-апп: цены в одном месте
export function loadMenu(file = fileURLToPath(new URL('../../../web/src/data/menu.json', import.meta.url))): MenuData {
  return JSON.parse(readFileSync(file, 'utf8')) as MenuData
}

/** Следующий кофе бесплатный: куплено N-1 из N в текущем круге */
export function freeNow(stamps: number, stampsForFree: number) {
  return stamps % stampsForFree === stampsForFree - 1
}

export type Priced =
  | { ok: true; lines: OrderLine[]; total: number; stampsEarned: number; discount: number }
  | { ok: false; error: string }

/**
 * Цена считается только здесь, на сервере. Клиент присылает что выбрал,
 * а не сколько это стоит: иначе итог можно подменить.
 */
export function priceOrder(menu: MenuData, rawLines: unknown, useFreeCoffee: boolean): Priced {
  if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 30) return { ok: false, error: 'empty order' }
  const lines: OrderLine[] = []
  for (const raw of rawLines as Record<string, unknown>[]) {
    const item = menu.items.find((i) => i.id === raw?.itemId)
    if (!item) return { ok: false, error: 'unknown item' }
    const variant = item.variants.find((v) => v.label === (raw.variant ?? ''))
    if (!variant) return { ok: false, error: 'unknown variant' }
    const qty = raw.qty
    if (!Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > 20) return { ok: false, error: 'bad qty' }
    const addonTitles = Array.isArray(raw.addons) ? raw.addons.map(String) : []
    if (addonTitles.length > 5) return { ok: false, error: 'bad addons' }
    const addons = []
    for (const title of addonTitles) {
      const a = menu.addons.find((x) => x.title === title && x.forCategories.includes(item.category))
      if (!a) return { ok: false, error: 'unknown addon' }
      addons.push(a)
    }
    const unit = variant.price + addons.reduce((s, a) => s + a.price, 0)
    lines.push({
      itemId: item.id,
      title: item.title,
      variant: variant.label,
      addons: addons.map((a) => a.title),
      qty: qty as number,
      price: unit * (qty as number),
      category: item.category,
    })
  }

  const { countsCategories } = menu.shop.loyalty
  const coffee = lines.filter((l) => countsCategories.includes(l.category))
  if (useFreeCoffee && coffee.length === 0) return { ok: false, error: 'no coffee for free cup' }
  // бесплатно: самый дешёвый кофейный напиток, без добавок (как показывает корзина)
  const discount = useFreeCoffee
    ? Math.min(...coffee.map((l) => menu.items.find((i) => i.id === l.itemId)!.variants.find((v) => v.label === l.variant)!.price))
    : 0
  const total = lines.reduce((s, l) => s + l.price, 0) - discount
  const stampsEarned = coffee.reduce((s, l) => s + l.qty, 0)
  return { ok: true, lines, total, stampsEarned, discount }
}

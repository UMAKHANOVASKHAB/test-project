import type { Addon, MenuItem, Variant } from '../types/menu'

export interface CartLine {
  key: string // itemId|variantLabel|addonIds
  item: MenuItem
  variant: Variant
  addons: Addon[]
  qty: number
}

export interface CartState {
  lines: CartLine[]
}

export type CartAction =
  | { type: 'add'; item: MenuItem; variant: Variant; addons?: Addon[] }
  | { type: 'inc'; key: string }
  | { type: 'dec'; key: string }
  | { type: 'remove'; key: string }
  | { type: 'clear' }

export const emptyCart: CartState = { lines: [] }

export function lineKey(item: MenuItem, variant: Variant, addons: Addon[]): string {
  const a = addons.map((x) => x.id).sort().join('+')
  return `${item.id}|${variant.label}|${a}`
}

export function linePrice(line: CartLine): number {
  const addons = line.addons.reduce((s, a) => s + a.price, 0)
  return (line.variant.price + addons) * line.qty
}

export function cartTotal(state: CartState): number {
  return state.lines.reduce((s, l) => s + linePrice(l), 0)
}

export function cartCount(state: CartState): number {
  return state.lines.reduce((s, l) => s + l.qty, 0)
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const addons = action.addons ?? []
      const key = lineKey(action.item, action.variant, addons)
      const existing = state.lines.find((l) => l.key === key)
      if (existing) {
        return { lines: state.lines.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) }
      }
      return { lines: [...state.lines, { key, item: action.item, variant: action.variant, addons, qty: 1 }] }
    }
    case 'inc':
      return { lines: state.lines.map((l) => (l.key === action.key ? { ...l, qty: l.qty + 1 } : l)) }
    case 'dec':
      return {
        lines: state.lines
          .map((l) => (l.key === action.key ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      }
    case 'remove':
      return { lines: state.lines.filter((l) => l.key !== action.key) }
    case 'clear':
      return emptyCart
  }
}

import type { MenuItem } from '../types/menu'

/** Объём, общий для всех позиций раздела ("300 мл"), чтобы писать его у заголовка, как в бумажном меню. */
export function sharedVolume(items: MenuItem[]): string | null {
  if (items.length === 0) return null
  const labels = items.map((it) => (it.variants.length === 1 ? it.variants[0].label : null))
  const first = labels[0]
  if (!first || !/мл/.test(first)) return null
  return labels.every((l) => l === first) ? first : null
}

/** Цена как в меню: "250 ₽" или "250/300 ₽". */
export function priceLabel(item: MenuItem): string {
  return `${item.variants.map((v) => v.price).join('/')} ₽`
}

/** Объём рядом с названием, если он не вынесен к заголовку: "300 мл" или "200/300 мл". */
export function volumeLabel(item: MenuItem): string {
  const labels = item.variants.map((v) => v.label).filter((l) => /мл/.test(l))
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.map((l) => l.replace(/\s*мл/, '')).join('/')} мл`
}

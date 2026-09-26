/**
 * Карта лояльности: каждый N-й кофе бесплатно.
 * stamps — сколько кофейных напитков куплено всего (накопительно).
 */
export interface LoyaltyState {
  /** заполненных кружков на карте (0..N-1) */
  filled: number
  /** всего кружков */
  total: number
  /** следующий кофе бесплатный */
  freeNow: boolean
  /** сколько ещё купить до бесплатного */
  left: number
}

export function loyaltyState(stamps: number, stampsForFree: number): LoyaltyState {
  const total = stampsForFree
  const cycle = stamps % total
  // после N-1 покупок следующая (N-я) бесплатная
  const freeNow = cycle === total - 1
  return {
    filled: cycle,
    total,
    freeNow,
    left: freeNow ? 0 : total - 1 - cycle,
  }
}

/** Сколько штампов даёт заказ: по одному за каждый напиток из «кофейных» категорий. */
export function stampsForOrder(
  lines: { category: string; qty: number }[],
  countsCategories: string[],
): number {
  return lines
    .filter((l) => countsCategories.includes(l.category))
    .reduce((sum, l) => sum + l.qty, 0)
}

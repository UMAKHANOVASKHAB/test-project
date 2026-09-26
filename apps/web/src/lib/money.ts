const fmt = new Intl.NumberFormat('ru-RU')

/** 1250 → "1 250 ₽" */
export function rub(amount: number): string {
  return `${fmt.format(amount)} ₽`
}

/** Время кофейни считаем по её часовому поясу, а не по часам сервера (на Railway это UTC). */
export function minutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return (get('hour') % 24) * 60 + get('minute')
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export type PickupCheck = 'ok' | 'closed' | 'past'

/**
 * Можно ли забрать заказ в это время сегодня: в часы работы и не раньше текущей минуты.
 * Мини-апп предлагает только такие слоты, а сервер не верит клиенту и проверяет сам.
 */
export function checkPickup(pickupAt: string, hours: { open: string; close: string }, timeZone: string, now = new Date()): PickupCheck {
  const t = toMin(pickupAt)
  if (t < toMin(hours.open) || t > toMin(hours.close)) return 'closed'
  if (t < minutesInZone(now, timeZone)) return 'past'
  return 'ok'
}

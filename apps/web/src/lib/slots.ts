/** Сколько минут прошло с полуночи в часовом поясе кофейни (с долями минуты). Без пояса берём часы телефона. */
export function minutesOfDay(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return (get('hour') % 24) * 60 + get('minute') + get('second') / 60
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Слоты самовывоза на сегодня: от «сейчас + leadMin» до закрытия, с шагом stepMin.
 * Время считается по часовому поясу кофейни: у гостя с телефоном на другом времени слоты те же.
 * Возвращает строки "HH:MM". Пустой массив, если до закрытия не остаётся ни одного слота.
 */
export function pickupSlots(now: Date, open: string, close: string, stepMin = 15, leadMin = 10, timeZone?: string): string[] {
  const opensAt = toMin(open)
  const closesAt = toMin(close)
  // ближайшее время с учётом подготовки, округлённое вверх до шага
  const earliest = Math.ceil((minutesOfDay(now, timeZone) + leadMin) / stepMin) * stepMin
  const out: string[] = []
  for (let t = Math.max(earliest, opensAt); t <= closesAt; t += stepMin) out.push(hhmm(t))
  return out
}

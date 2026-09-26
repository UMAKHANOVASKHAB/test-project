/**
 * Слоты самовывоза на сегодня: от «сейчас + leadMin» до закрытия, с шагом stepMin.
 * Возвращает строки "HH:MM". Пустой массив, если кофейня уже закрыта или ещё не открылась
 * так, что до закрытия не остаётся ни одного слота.
 */
export function pickupSlots(
  now: Date,
  open: string,
  close: string,
  stepMin = 15,
  leadMin = 10,
): string[] {
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)

  const opensAt = new Date(now)
  opensAt.setHours(oh, om, 0, 0)
  const closesAt = new Date(now)
  closesAt.setHours(ch, cm, 0, 0)

  // Ближайшее время с учётом подготовки, округлённое вверх до шага
  const earliest = new Date(now.getTime() + leadMin * 60_000)
  const ms = stepMin * 60_000
  const rounded = new Date(Math.ceil(earliest.getTime() / ms) * ms)

  let cursor = rounded < opensAt ? opensAt : rounded
  const out: string[] = []
  while (cursor <= closesAt) {
    out.push(hhmm(cursor))
    cursor = new Date(cursor.getTime() + ms)
  }
  return out
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

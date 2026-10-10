import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TgUser {
  id: number
  name: string
}

/**
 * Проверка initData мини-аппа по документации Telegram
 * (core.telegram.org/bots/webapps, «Validating data received via the Mini App»).
 * Без проверки любой может прислать чужой userId и забрать чужие штампы.
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 24 * 60 * 60, now = Date.now()): TgUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest()
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null

  // старые данные не принимаем: ссылку с initData могли перехватить
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) return null

  try {
    const u = JSON.parse(params.get('user') ?? '')
    if (!Number.isInteger(u?.id)) return null
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Гость'
    return { id: u.id, name: String(name).slice(0, 80) }
  } catch {
    return null
  }
}

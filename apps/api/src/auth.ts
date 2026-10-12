import { createHmac, timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'

export interface TgUser {
  id: number
  name: string
}

/**
 * Проверка initData мини-аппа по документации Telegram:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Без проверки любой может прислать чужой userId (например, через curl).
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 24 * 60 * 60, now = Date.now()): TgUser | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(dataCheckString).digest()
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null

  // старые initData не принимаем, чтобы перехваченную подпись нельзя было использовать вечно
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) return null

  try {
    const u = JSON.parse(params.get('user') ?? '')
    if (!Number.isSafeInteger(u?.id) || u.id <= 0) return null
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 80) || 'Гость'
    return { id: u.id, name }
  } catch {
    return null
  }
}

/**
 * Кладёт проверенного пользователя в res.locals.user.
 * Без подписи (браузер вне Telegram) запрос идёт как гость с id 0: меню смотреть можно, заказывать нельзя.
 */
export function telegramAuth(botToken: string): RequestHandler {
  return (req, res, next) => {
    const header = req.get('authorization') ?? ''
    if (!header.startsWith('tma ')) {
      res.locals.user = { id: 0, name: 'Гость' }
      return next()
    }
    const user = verifyInitData(header.slice(4), botToken)
    // подпись есть, но не сходится или устарела: не превращаем молча в гостя, иначе штампы потеряются
    if (!user) return res.status(401).json({ error: 'bad init data' })
    res.locals.user = user
    next()
  }
}

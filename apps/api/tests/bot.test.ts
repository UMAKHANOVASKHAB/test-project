import { afterEach, describe, expect, it } from 'vitest'
import { createBot } from '../src/bot/index.js'
import { openDb } from '../src/db/index.js'

const ADMIN = 555
const GUEST = 42

// Бот без сети: все вызовы Telegram API перехватываем и записываем
function setup() {
  process.env.ADMIN_CHAT_ID = String(ADMIN)
  const db = openDb(':memory:')
  const { bot, notifyOrder } = createBot('123456:' + 'x'.repeat(35), db, '')
  const calls: { method: string; payload: any }[] = []
  bot.botInfo = { id: 1, is_bot: true, first_name: 'bot', username: 'bot' } as any
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload })
    return { ok: true, result: method === 'sendMessage' ? { message_id: 1, date: 0, chat: { id: 0, type: 'private' } } : true } as any
  })
  const press = (data: string, chatId = ADMIN) =>
    bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'q', data, chat_instance: 'c',
        from: { id: chatId, is_bot: false, first_name: 'Бариста' },
        message: { message_id: 1, date: 0, chat: { id: chatId, type: 'private', first_name: 'Бариста' }, text: 'заказ' },
      },
    } as any)
  return { db, notifyOrder, calls, press }
}

describe('кнопки бариста', () => {
  afterEach(() => { delete process.env.ADMIN_CHAT_ID })
  const order = { userId: GUEST, userName: 'Асхаб', lines: [], total: 290, pickupAt: '12:15', comment: '', useFreeCoffee: false }

  it('заказ приходит с кнопками, штамп только по «Выдан», гость получает сообщения', async () => {
    const { db, notifyOrder, calls, press } = setup()
    const o = db.createOrder(order, 1)
    await notifyOrder(o)
    const sent = calls.find((c) => c.method === 'sendMessage')!
    expect(sent.payload.chat_id).toBe(String(ADMIN))
    expect(JSON.stringify(sent.payload.reply_markup)).toContain(`st:issued:${o.id}`)

    await press(`st:ready:${o.id}`)
    expect(db.getStamps(GUEST)).toBe(0)
    expect(calls.some((c) => c.method === 'sendMessage' && c.payload.chat_id === GUEST && /готов/.test(c.payload.text))).toBe(true)

    await press(`st:issued:${o.id}`)
    expect(db.getStamps(GUEST)).toBe(1)
    const edit = calls.filter((c) => c.method === 'editMessageText').at(-1)!
    expect(edit.payload.text).toContain('Выдан')
    expect(edit.payload.reply_markup).toBeUndefined()

    // повторное нажатие не задваивает
    await press(`st:issued:${o.id}`)
    expect(db.getStamps(GUEST)).toBe(1)
  })

  it('чужой чат не может выдать заказ', async () => {
    const { db, press } = setup()
    const o = db.createOrder(order, 1)
    await press(`st:issued:${o.id}`, 999)
    expect(db.getOrder(o.id)!.status).toBe('new')
    expect(db.getStamps(GUEST)).toBe(0)
  })

  it('ошибка в обработчике не останавливает бота', async () => {
    process.env.ADMIN_CHAT_ID = String(ADMIN)
    const db = openDb(':memory:')
    const { bot } = createBot('123456:' + 'x'.repeat(35), db, '')
    bot.botInfo = { id: 1, is_bot: true, first_name: 'bot', username: 'bot' } as any
    // Telegram не ответил: любой вызов API падает
    bot.api.config.use(async () => { throw new Error('network down') })
    const update = {
      update_id: 3,
      message: { message_id: 3, date: 0, chat: { id: 7, type: 'private', first_name: 'X' }, from: { id: 7, is_bot: false, first_name: 'X' }, text: '/start', entities: [{ type: 'bot_command', offset: 0, length: 6 }] },
    } as any
    // так бот получает сообщения при опросе: без bot.catch здесь grammY вызывает bot.stop() и пробрасывает ошибку
    await expect(bot.handleUpdates([update])).resolves.toBeUndefined()
  })

  it('/start берёт число для бесплатного кофе из меню', async () => {
    const db = openDb(':memory:')
    const { bot } = createBot('123456:' + 'x'.repeat(35), db, '', { stampsForFree: 8 })
    bot.botInfo = { id: 1, is_bot: true, first_name: 'bot', username: 'bot' } as any
    const sent: any[] = []
    bot.api.config.use(async (_p, method, payload) => (sent.push({ method, payload }), { ok: true, result: { message_id: 1, date: 0, chat: { id: 7, type: 'private' } } } as any))
    await bot.handleUpdate({
      update_id: 4,
      message: { message_id: 4, date: 0, chat: { id: 7, type: 'private', first_name: 'X' }, from: { id: 7, is_bot: false, first_name: 'X' }, text: '/start', entities: [{ type: 'bot_command', offset: 0, length: 6 }] },
    } as any)
    expect(sent.find((c) => c.method === 'sendMessage')!.payload.text).toContain('Каждый 8-й кофе бесплатно')
  })

  it('/admin не перехватывает заказы, если задан ADMIN_CHAT_ID', async () => {
    const { db, calls } = setup()
    const { bot } = createBot('123456:' + 'x'.repeat(35), db, '')
    bot.botInfo = { id: 1, is_bot: true, first_name: 'bot', username: 'bot' } as any
    bot.api.config.use(async (_p, method, payload) => (calls.push({ method, payload }), { ok: true, result: true } as any))
    await bot.handleUpdate({
      update_id: 2,
      message: { message_id: 2, date: 0, chat: { id: 999, type: 'private', first_name: 'X' }, from: { id: 999, is_bot: false, first_name: 'X' }, text: '/admin', entities: [{ type: 'bot_command', offset: 0, length: 6 }] },
    } as any)
    expect(db.getSetting('admin_chat_id')).toBeUndefined()
    expect(calls.at(-1)!.payload.text).toContain('задан в настройках')
  })
})

import { Bot, InlineKeyboard, InputFile } from 'grammy'
import type { Db, OrderRow } from '../db/index.js'

const ADMIN_KEY = 'admin_chat_id'

export function createBot(token: string, db: Db, webappUrl: string) {
  const bot = new Bot(token)

  const adminChatId = () => process.env.ADMIN_CHAT_ID || db.getSetting(ADMIN_KEY)

  bot.command('start', async (ctx) => {
    const kb = webappUrl ? new InlineKeyboard().webApp('☕️ Открыть меню', webappUrl) : undefined
    await ctx.reply(
      'Ассаляму алейкум! Это 9 bar coffee, ул. Леваневского, 11.\n\n' +
        'Здесь можно посмотреть меню, заказать заранее и забрать без очереди. Каждый 6-й кофе бесплатно.',
      { reply_markup: kb },
    )
  })

  // Кто получает заказы: ADMIN_CHAT_ID из переменных или первый, кто напишет /admin.
  // Переназначить через /admin нельзя, иначе любой гость перехватит заказы кофейни.
  bot.command('admin', async (ctx) => {
    const current = adminChatId()
    if (current && current !== String(ctx.chat.id)) {
      await ctx.reply('Получатель заказов уже назначен. Сменить его может владелец через ADMIN_CHAT_ID в настройках сервера.')
      return
    }
    db.setSetting(ADMIN_KEY, String(ctx.chat.id))
    await ctx.reply(`Готово. Заказы будут приходить в этот чат (id ${ctx.chat.id}).`)
  })

  // Куда слать резервные копии: отдельный чат BACKUP_CHAT_ID, иначе чат получателя заказов
  const backupChatId = () => process.env.BACKUP_CHAT_ID || adminChatId()

  async function sendBackup(name: string, data: Buffer) {
    const to = backupChatId()
    if (!to) throw new Error('не задан BACKUP_CHAT_ID и не назначен получатель заказов')
    await bot.api.sendDocument(to, new InputFile(data, name), {
      caption: `Резервная копия базы 9 bar coffee, ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК`,
    })
  }

  async function reportBackupError(e: unknown) {
    const to = adminChatId()
    if (to) await bot.api.sendMessage(to, `⚠️ Резервная копия базы не сделана: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Ручная копия по команде, только из чата, куда копии и приходят
  let runBackup: (() => Promise<void>) | null = null
  bot.command('backup', async (ctx) => {
    if (String(ctx.chat.id) !== String(backupChatId())) return
    if (!runBackup) return ctx.reply('Резервное копирование ещё не запущено')
    await ctx.reply('Делаю копию…')
    await runBackup()
  })

  bot.command('id', async (ctx) => {
    await ctx.reply(`Ваш chat id: ${ctx.chat.id}`)
  })

  async function notifyOrder(o: OrderRow) {
    const to = adminChatId()
    if (!to) return false
    const lines = o.lines
      .map((l) => {
        const parts = [l.title, l.variant, ...l.addons].filter(Boolean).join(' · ')
        return `• ${parts}${l.qty > 1 ? ` ×${l.qty}` : ''} — ${l.price} ₽`
      })
      .join('\n')
    const text =
      `🧾 <b>Заказ №${o.id}</b> · заберут в <b>${o.pickupAt}</b>\n` +
      `👤 ${escapeHtml(o.userName)}\n\n` +
      `${escapeHtml(lines)}\n\n` +
      (o.useFreeCoffee ? `🎁 Бесплатный кофе по карте\n` : '') +
      (o.comment ? `💬 ${escapeHtml(o.comment)}\n` : '') +
      `\n<b>Итого: ${o.total} ₽</b> · оплата при получении`
    await bot.api.sendMessage(to, text, { parse_mode: 'HTML' })
    return true
  }

  async function notifyGuest(o: OrderRow) {
    if (!o.userId) return
    try {
      await bot.api.sendMessage(
        o.userId,
        `✅ Заказ №${o.id} принят. Будет готов к ${o.pickupAt}. Покажите это сообщение бариста.`,
      )
    } catch {
      /* гость не начинал диалог с ботом: Telegram не даст написать первым */
    }
  }

  // Кнопка «Меню» слева от поля ввода открывает мини-апп
  if (webappUrl) {
    bot.api
      .setChatMenuButton({ menu_button: { type: 'web_app', text: 'Меню', web_app: { url: webappUrl } } })
      .catch((e) => console.error('setChatMenuButton', e))
  }

  return {
    bot,
    notifyOrder,
    notifyGuest,
    sendBackup,
    reportBackupError,
    setBackupRunner: (fn: () => Promise<void>) => {
      runBackup = fn
    },
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

import { Bot, InlineKeyboard, InputFile } from 'grammy'
import { rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupName, isSqliteFile } from '../backup.js'
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

  // Кто получает заказы: первый, кто напишет /admin, или ADMIN_CHAT_ID из .env
  bot.command('admin', async (ctx) => {
    db.setSetting(ADMIN_KEY, String(ctx.chat.id))
    await ctx.reply(`Готово. Заказы будут приходить в этот чат (id ${ctx.chat.id}).`)
  })

  bot.command('id', async (ctx) => {
    await ctx.reply(`Ваш chat id: ${ctx.chat.id}`)
  })

  // Копии и восстановление только для владельца из переменной ADMIN_CHAT_ID: /admin тут не считается
  const isOwner = (chatId: number) => !!process.env.ADMIN_CHAT_ID && String(chatId) === process.env.ADMIN_CHAT_ID.trim()
  const backupChatId = () => (process.env.BACKUP_CHAT_ID || process.env.ADMIN_CHAT_ID || '').trim()

  async function sendBackup(note = 'Ежедневная копия') {
    const to = backupChatId()
    if (!to) {
      console.error('Резервная копия: не задан BACKUP_CHAT_ID (или ADMIN_CHAT_ID)')
      return false
    }
    const name = backupName()
    const tmp = join(tmpdir(), name)
    try {
      await db.backup(tmp)
      await bot.api.sendDocument(to, new InputFile(tmp, name), { caption: `💾 ${note} базы 9 bar coffee` })
    } finally {
      rmSync(tmp, { force: true })
    }
    return true
  }

  bot.command('backup', async (ctx) => {
    if (!isOwner(ctx.chat.id)) return
    const ok = await sendBackup('Копия по команде').catch((e) => (console.error('backup', e), false))
    await ctx.reply(ok ? 'Копия отправлена.' : 'Не получилось сделать копию, подробности в логах Railway.')
  })

  // Восстановление: владелец присылает боту файл копии с подписью /restore
  bot.on('message:document', async (ctx) => {
    if (ctx.message.caption?.trim() !== '/restore' || !isOwner(ctx.chat.id)) return
    if (db.file === ':memory:') return void (await ctx.reply('База в памяти, восстанавливать некуда.'))
    try {
      const f = await ctx.getFile()
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`)
      if (!res.ok) throw new Error(`скачивание: HTTP ${res.status}`)
      const buf = new Uint8Array(await res.arrayBuffer())
      if (!isSqliteFile(buf)) return void (await ctx.reply('Это не файл базы. Пришлите файл ninebar-….db из канала копий.'))
      // перед подменой сохраняем текущую базу, чтобы ошибку можно было откатить
      await sendBackup('Копия перед восстановлением')
      writeFileSync(`${db.file}.restore`, buf)
      await ctx.reply('Файл принят. Перезапускаюсь, через минуту база будет из копии.')
    } catch (e) {
      console.error('restore', e)
      return void (await ctx.reply('Не получилось восстановить, подробности в логах Railway.'))
    }
    // Railway поднимет сервис заново, а при запуске база подменится из файла .restore
    setTimeout(() => {
      db.close()
      process.exit(1)
    }, 1000)
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

  return { bot, notifyOrder, notifyGuest, sendBackup }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

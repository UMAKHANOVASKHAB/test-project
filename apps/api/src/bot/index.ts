import { Bot, InlineKeyboard, InputFile } from 'grammy'
import { rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupName, isSqliteFile } from '../backup.js'
import type { Db, OrderRow, OrderStatus } from '../db/index.js'

const ADMIN_KEY = 'admin_chat_id'

export function createBot(token: string, db: Db, webappUrl: string) {
  const bot = new Bot(token)

  // Без своего обработчика grammY при любой ошибке в команде (гость заблокировал бота, старая кнопка)
  // останавливает бота насовсем, а сайт продолжает работать и Railway ничего не перезапускает
  bot.catch((err) => console.error(`Ошибка бота на обновлении ${err.ctx.update.update_id}:`, err.error))

  // пробелы и перенос строки при вставке с телефона иначе ломают сравнение с id чата
  const envAdmin = () => (process.env.ADMIN_CHAT_ID ?? '').trim()
  const adminChatId = () => envAdmin() || db.getSetting(ADMIN_KEY)

  bot.command('start', async (ctx) => {
    const kb = webappUrl ? new InlineKeyboard().webApp('☕️ Открыть меню', webappUrl) : undefined
    await ctx.reply(
      'Ассаляму алейкум! Это 9 bar coffee, ул. Леваневского, 11.\n\n' +
        'Здесь можно посмотреть меню, заказать заранее и забрать без очереди. Каждый 6-й кофе бесплатно.',
      { reply_markup: kb },
    )
  })

  // Кто получает заказы. Если задан ADMIN_CHAT_ID, перехватить заказы командой нельзя.
  // Без переменной чат закрепляет только первый, кто напишет /admin
  bot.command('admin', async (ctx) => {
    if (envAdmin()) {
      const mine = String(ctx.chat.id) === envAdmin()
      return void (await ctx.reply(mine ? 'Заказы уже приходят в этот чат.' : 'Получатель заказов задан в настройках сервера.'))
    }
    const current = db.getSetting(ADMIN_KEY)
    if (current && current !== String(ctx.chat.id)) return void (await ctx.reply('Получатель заказов уже назначен.'))
    db.setSetting(ADMIN_KEY, String(ctx.chat.id))
    await ctx.reply(`Готово. Заказы будут приходить в этот чат (id ${ctx.chat.id}).`)
  })

  bot.command('id', async (ctx) => {
    await ctx.reply(`Ваш chat id: ${ctx.chat.id}`)
  })

  // Копии и восстановление только для владельца из переменной ADMIN_CHAT_ID: /admin тут не считается
  const isOwner = (chatId: number) => !!envAdmin() && String(chatId) === envAdmin()
  const backupChatId = () => (process.env.BACKUP_CHAT_ID ?? '').trim() || envAdmin()

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

  function orderText(o: OrderRow) {
    const lines = o.lines
      .map((l) => {
        const parts = [l.title, l.variant, ...l.addons].filter(Boolean).join(' · ')
        return `• ${parts}${l.qty > 1 ? ` ×${l.qty}` : ''} — ${l.price} ₽`
      })
      .join('\n')
    return (
      `🧾 <b>Заказ №${o.id}</b> · заберут в <b>${o.pickupAt}</b>\n` +
      `👤 ${escapeHtml(o.userName)}\n\n` +
      `${escapeHtml(lines)}\n\n` +
      (o.useFreeCoffee ? `🎁 Бесплатный кофе по карте\n` : '') +
      (o.comment ? `💬 ${escapeHtml(o.comment)}\n` : '') +
      `\n<b>Итого: ${o.total} ₽</b> · оплата при получении` +
      (STATUS_LINE[o.status] ? `\n\n${STATUS_LINE[o.status]}` : '')
    )
  }

  // Кнопки под заказом у бариста. Штампы гостю начисляются только по «Выдан»
  function orderKeyboard(o: OrderRow) {
    if (o.status === 'issued' || o.status === 'cancelled') return undefined
    const kb = new InlineKeyboard()
    if (o.status === 'new') kb.text('☕️ Готов', `st:ready:${o.id}`)
    return kb.text('🤝 Выдан', `st:issued:${o.id}`).row().text('✖️ Отменить', `st:cancelled:${o.id}`)
  }

  async function notifyOrder(o: OrderRow) {
    const to = adminChatId()
    if (!to) {
      // иначе гость видит «заказ принят», а бариста о нём не узнает
      console.error(`Заказ №${o.id} никому не отправлен: не задан ADMIN_CHAT_ID и никто не написал /admin`)
      return false
    }
    await bot.api.sendMessage(to, orderText(o), { parse_mode: 'HTML', reply_markup: orderKeyboard(o) })
    return true
  }

  bot.callbackQuery(/^st:(ready|issued|cancelled):(\d+)$/, async (ctx) => {
    // нажимать может только чат бариста: кнопки в пересланном сообщении не сработают
    if (String(ctx.chat?.id) !== String(adminChatId())) return void (await ctx.answerCallbackQuery({ text: 'Нет доступа' }))
    const status = ctx.match[1] as OrderStatus
    const r = db.setStatus(Number(ctx.match[2]), status)
    if (!r.ok) {
      await ctx.answerCallbackQuery({ text: 'Статус уже изменён' })
      // обновляем сообщение, если его состояние отстало от базы (например, нажали дважды)
      if (r.order) await ctx.editMessageText(orderText(r.order), { parse_mode: 'HTML', reply_markup: orderKeyboard(r.order) }).catch(() => {})
      return
    }
    await ctx.answerCallbackQuery({ text: STATUS_LINE[status] })
    await ctx.editMessageText(orderText(r.order), { parse_mode: 'HTML', reply_markup: orderKeyboard(r.order) }).catch(() => {})
    await notifyStatus(r.order, r.stamps)
  })

  async function notifyStatus(o: OrderRow, stamps: number) {
    if (!o.userId) return
    const text =
      o.status === 'ready'
        ? `☕️ Заказ №${o.id} готов, можно забирать.`
        : o.status === 'issued'
          ? `🤝 Заказ №${o.id} выдан, приятного аппетита!` +
            (o.stampsEarned ? ` Начислено штампов: ${o.stampsEarned}, всего на карте: ${stamps}.` : '')
          : `✖️ Заказ №${o.id} отменён. Если это ошибка, напишите или позвоните нам.`
    await bot.api.sendMessage(o.userId, text).catch(() => {
      /* гость не начинал диалог с ботом */
    })
  }

  async function notifyGuest(o: OrderRow) {
    if (!o.userId) return
    try {
      await bot.api.sendMessage(
        o.userId,
        `✅ Заказ №${o.id} принят. Будет готов к ${o.pickupAt}. Покажите это сообщение бариста. Штампы начислятся, когда заберёте заказ.`,
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

const STATUS_LINE: Partial<Record<OrderStatus, string>> = {
  ready: '☕️ Готов, ждёт гостя',
  issued: '🤝 Выдан',
  cancelled: '✖️ Отменён',
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

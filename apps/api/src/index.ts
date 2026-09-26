import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createBot } from './bot/index.js'
import { openDb } from './db/index.js'
import { ordersRouter } from './routes/orders.js'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// trim: при вставке с телефона токен часто прилетает с пробелом или переносом строки
const token = process.env.BOT_TOKEN?.trim()
if (!token) throw new Error('BOT_TOKEN не задан (apps/api/.env)')

const db = openDb()
const { bot, notifyOrder, notifyGuest } = createBot(token, db, (process.env.WEBAPP_URL ?? '').trim())

const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use(ordersRouter(db, { notifyOrder, notifyGuest }))

// Отдаём собранный мини-апп с того же адреса, чтобы для демо хватило одного туннеля
const webDist = resolve(process.env.WEB_DIST ?? '../web/dist')
if (existsSync(webDist)) {
  app.use(express.static(webDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(resolve(webDist, 'index.html')))
}

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`API на http://localhost:${port}`))

// Ошибка бота (неверный токен, второй запуск) не должна ронять сайт мини-аппа
bot
  .start({ onStart: (me) => console.log(`Бот @${me.username} запущен`) })
  .catch((e) => console.error('Бот не запустился. Проверьте BOT_TOKEN в переменных:', e?.description ?? e))

process.on('SIGINT', () => { bot.stop(); db.close(); process.exit(0) })
process.on('SIGTERM', () => { bot.stop(); db.close(); process.exit(0) })

import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createBot } from './bot/index.js'
import { openDb } from './db/index.js'
import { loadMenu } from './lib/pricing.js'
import { ordersRouter } from './routes/orders.js'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// С телефона токен часто вставляют вместе с текстом BotFather: вытаскиваем сам токен
const rawToken = process.env.BOT_TOKEN ?? ''
const token = rawToken.match(/\d{6,}:[A-Za-z0-9_-]{30,}/)?.[0] ?? rawToken.trim()
// Railway сам сообщает свой адрес, поэтому WEBAPP_URL можно не задавать
const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
const webappUrl = (process.env.WEBAPP_URL ?? '').trim() || (railwayDomain ? `https://${railwayDomain}` : '')

const db = openDb()
// Без токена поднимаем только сайт мини-аппа, чтобы сервис не падал
const created = token ? createBot(token, db, webappUrl) : null
if (!created) console.error('BOT_TOKEN не задан: работает только сайт, бот выключен')
const bot = created?.bot
const notifyOrder = created?.notifyOrder ?? (async () => false)
const notifyGuest = created?.notifyGuest ?? (async () => {})

const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use(ordersRouter(db, { notifyOrder, notifyGuest }, loadMenu(), token))

// Отдаём собранный мини-апп с того же адреса, чтобы для демо хватило одного туннеля
const webDist = resolve(process.env.WEB_DIST ?? '../web/dist')
if (existsSync(webDist)) {
  app.use(express.static(webDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(resolve(webDist, 'index.html')))
}

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`Сервер слушает порт ${port}, мини-апп: ${webappUrl || 'адрес не задан'}`))

// Ошибка бота (неверный токен, второй запуск) не должна ронять сайт мини-аппа
bot
  ?.start({ onStart: (me) => console.log(`Бот @${me.username} запущен`) })
  .catch((e) => console.error('Бот не запустился. Проверьте BOT_TOKEN в переменных:', e?.description ?? e))

process.on('SIGINT', () => { bot?.stop(); db.close(); process.exit(0) })
process.on('SIGTERM', () => { bot?.stop(); db.close(); process.exit(0) })

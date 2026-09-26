import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createBot } from './bot/index.js'
import { openDb } from './db/index.js'
import { ordersRouter } from './routes/orders.js'

const token = process.env.BOT_TOKEN
if (!token) throw new Error('BOT_TOKEN не задан (apps/api/.env)')

const db = openDb()
const { bot, notifyOrder, notifyGuest } = createBot(token, db, process.env.WEBAPP_URL ?? '')

const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use(ordersRouter(db, { notifyOrder, notifyGuest }))

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`API на http://localhost:${port}`))

bot.start({ onStart: (me) => console.log(`Бот @${me.username} запущен`) })

process.on('SIGINT', () => { bot.stop(); db.close(); process.exit(0) })
process.on('SIGTERM', () => { bot.stop(); db.close(); process.exit(0) })

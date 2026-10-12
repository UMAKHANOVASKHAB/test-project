import { initData } from './telegram'

/**
 * Слой данных. Сейчас localApi (localStorage) для демо без сервера.
 * Когда появится бэк, VITE_API_URL переключит на remoteApi без правок экранов.
 */
export interface OrderLine {
  itemId: string
  title: string
  variant: string
  addons: string[]
  qty: number
  price: number // за строку, рубли
  category: string
}

export interface NewOrder {
  userId: number
  userName: string
  lines: OrderLine[]
  total: number
  pickupAt: string // "HH:MM"
  comment: string
  useFreeCoffee: boolean
}

export interface Order extends NewOrder {
  id: number
  createdAt: string // ISO
}

export interface Api {
  createOrder(o: NewOrder, stampsEarned: number): Promise<Order>
  getStamps(userId: number): Promise<number>
  listOrders(userId: number): Promise<Order[]>
}

const KEY = (userId: number) => `ninebar:${userId}`

interface LocalStore {
  stamps: number
  orders: Order[]
  seq: number
}

function load(userId: number): LocalStore {
  try {
    const raw = localStorage.getItem(KEY(userId))
    if (raw) return JSON.parse(raw) as LocalStore
  } catch {
    /* приватный режим или чистка данных: начинаем с нуля */
  }
  return { stamps: 0, orders: [], seq: 100 }
}

function save(userId: number, s: LocalStore) {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(s))
  } catch {
    /* без хранилища заказ живёт только до перезагрузки */
  }
}

export const localApi: Api = {
  async createOrder(o, stampsEarned) {
    const s = load(o.userId)
    s.seq += 1
    const order: Order = { ...o, id: s.seq, createdAt: new Date().toISOString() }
    s.orders.unshift(order)
    s.orders = s.orders.slice(0, 20)
    // бесплатный кофе списывает цикл: штампы обнуляются до начала нового круга
    s.stamps = o.useFreeCoffee ? s.stamps + 1 + stampsEarned : s.stamps + stampsEarned
    save(o.userId, s)
    return order
  },
  async getStamps(userId) {
    return load(userId).stamps
  },
  async listOrders(userId) {
    return load(userId).orders
  },
}

export function remoteApi(baseUrl: string): Api {
  const json = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const auth = initData()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // кто заказывает, сервер узнаёт из подписи Telegram, а не из userId в запросе
    if (auth) headers.Authorization = `tma ${auth}`
    const r = await fetch(`${baseUrl}${path}`, { ...init, headers })
    if (!r.ok) throw new Error(`API ${r.status}`)
    return (await r.json()) as T
  }
  return {
    createOrder: (o, stampsEarned) => json('/api/orders', { method: 'POST', body: JSON.stringify({ ...o, stampsEarned }) }),
    getStamps: async () => (await json<{ stamps: number }>('/api/loyalty')).stamps,
    listOrders: () => json('/api/orders'),
  }
}

// VITE_API_URL='' означает «тот же адрес, что и приложение»; не задан вовсе означает демо без сервера
export const api: Api = import.meta.env.VITE_API_URL !== undefined ? remoteApi(import.meta.env.VITE_API_URL) : localApi

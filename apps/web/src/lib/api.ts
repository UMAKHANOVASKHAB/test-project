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
  /** одинаковый для повторов одного заказа: сервер не создаст дубль */
  clientKey?: string
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
    // штамп = купленный кофе, бесплатный тоже: 6-й закрывает круг ровно до нуля
    s.stamps += stampsEarned
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

export class ApiError extends Error {
  constructor(public status: number) {
    super(`API ${status}`)
  }
}

/**
 * Сервер сам узнаёт пользователя по подписи Telegram (заголовок Authorization)
 * и сам считает цены и штампы: userId и суммы в запросе ему не нужны.
 */
export function remoteApi(baseUrl: string, getInitData: () => string): Api {
  const json = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const auth = getInitData()
    const r = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `tma ${auth}` } : {}) },
    })
    if (!r.ok) throw new ApiError(r.status)
    return (await r.json()) as T
  }
  return {
    createOrder: (o) => json('/api/orders', { method: 'POST', body: JSON.stringify(o) }),
    getStamps: async () => (await json<{ stamps: number }>('/api/loyalty')).stamps,
    listOrders: () => json('/api/orders'),
  }
}

// VITE_API_URL='' означает «тот же адрес, что и приложение»; не задан вовсе означает демо без сервера
export const api: Api = import.meta.env.VITE_API_URL !== undefined ? remoteApi(import.meta.env.VITE_API_URL, initData) : localApi

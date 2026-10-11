import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Db } from '../db/index.js'

const DAY = 24 * 60 * 60 * 1000

/** Сколько миллисекунд до ближайшего hourUtc:00 по UTC */
export function msUntilNext(hourUtc: number, now = new Date()): number {
  const next = new Date(now)
  next.setUTCHours(hourUtc, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY)
  return next.getTime() - now.getTime()
}

/** Сжатая копия базы: имя файла и содержимое */
export async function makeBackup(db: Db, now = new Date()): Promise<{ name: string; data: Buffer }> {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const tmp = join(tmpdir(), `ninebar-backup-${stamp}-${process.pid}.db`)
  try {
    await db.backupTo(tmp)
    return { name: `ninebar-${stamp}.db.gz`, data: gzipSync(await readFile(tmp)) }
  } finally {
    await unlink(tmp).catch(() => {})
  }
}

/**
 * Каждый день в hourUtc отправляет копию базы за пределы Railway.
 * Сервер не вечен: если он умрёт вместе с диском, данные останутся в копиях.
 * Ошибка копии не роняет сервер, но пишется в лог громко, чтобы её заметили.
 */
export function startDailyBackup(
  db: Db,
  send: (name: string, data: Buffer) => Promise<void>,
  onError: (e: unknown) => Promise<void> = async () => {},
  hourUtc = 0,
) {
  const run = async () => {
    try {
      const { name, data } = await makeBackup(db)
      await send(name, data)
      console.log(`Резервная копия отправлена: ${name}, ${data.length} байт`)
    } catch (e) {
      console.error('РЕЗЕРВНАЯ КОПИЯ НЕ СДЕЛАНА:', e)
      await onError(e).catch((e2) => console.error('не удалось сообщить об ошибке копии', e2))
    }
  }
  const first = setTimeout(() => {
    void run()
    setInterval(() => void run(), DAY).unref()
  }, msUntilNext(hourUtc))
  first.unref()
  return run
}

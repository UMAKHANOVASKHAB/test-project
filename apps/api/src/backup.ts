import { existsSync, renameSync, rmSync } from 'node:fs'

const DAY = 24 * 60 * 60 * 1000

/** Сколько ждать до ближайшего hourUtc:00 по UTC. 00:00 UTC это 03:00 по Москве. */
export function msUntilNext(hourUtc: number, now = Date.now()): number {
  // кривое значение в переменной иначе дало бы NaN и копии без остановки
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) hourUtc = 0
  const d = new Date(now)
  let next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc)
  if (next <= now) next += DAY
  return next - now
}

/** Файл копии с датой в имени, чтобы в канале было видно, за какой день копия. */
export function backupName(now = new Date()) {
  return `ninebar-${now.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.db`
}

/** Файл SQLite начинается с этой строки: так отсекаем чужие файлы при восстановлении. */
export function isSqliteFile(buf: Uint8Array) {
  return Buffer.from(buf.subarray(0, 16)).toString('latin1') === 'SQLite format 3\u0000'
}

/**
 * Если рядом с базой лежит file.restore (его кладёт команда /restore), подменяем базу до открытия.
 * Старые -wal и -shm удаляем, иначе SQLite наложит их на восстановленную базу.
 */
export function applyPendingRestore(file: string) {
  const pending = `${file}.restore`
  if (!existsSync(pending)) return false
  for (const ext of ['-wal', '-shm']) rmSync(file + ext, { force: true })
  renameSync(pending, file)
  return true
}

/** Раз в сутки вызывает job. Ошибка копии не должна ронять сервер, поэтому только лог. */
export function scheduleDaily(hourUtc: number, job: () => Promise<void>) {
  let timer: NodeJS.Timeout
  const run = () => {
    timer = setTimeout(async () => {
      try {
        await job()
      } catch (e) {
        console.error('Резервная копия не отправлена:', e)
      }
      run()
    }, msUntilNext(hourUtc))
  }
  run()
  return () => clearTimeout(timer)
}

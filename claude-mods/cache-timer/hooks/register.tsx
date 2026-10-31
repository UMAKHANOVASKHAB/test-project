import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Кэш промпта живёт 60 минут с последнего ответа модели.
const TTL_MIN = 60
const WARN_MIN = 45
const TICK_MS = 30_000

const lastAt = atom({ plugin: 'cache-timer', key: 'lastAt' } as const, null)
const now = atom({ plugin: 'cache-timer', key: 'now' } as const, 0)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, now, () => t)
    $.clock.every(TICK_MS, () => {
      void $.clock.now().then(n => update($, now, () => n))
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, lastAt, () => t)
    await update($, now, () => t)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const last = await read($, lastAt)
    const current = await read($, now)
    if (e.props.hasSurvey || last === null || current === 0) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const passed = Math.max(0, Math.floor((current - last) / 60_000))
    const left = TTL_MIN - passed

    if (left <= 0) {
      return (
        <Box>
          <Text color="red">Кэш остыл: следующее сообщение перечитает весь чат по полной цене </Text>
          <Button key="compact" label="Сжать чат" onPress={() => void $.session.compact()} />
        </Box>
      )
    }

    return (
      <Box>
        <Text color={passed >= WARN_MIN ? 'yellow' : 'green'}>
          Кэш тёплый: ещё {left} мин
        </Text>
      </Box>
    )
  })
}

import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'cache-timer',
  component: 'AbovePrompt',
  props: { hasSurvey: false },
} as const

test('после ответа модели полоска показывает тёплый кэш', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, reason: 'answer' })
  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const row = await ui.find({ type: 'Text', text: /Кэш тёплый/ })
    expect(row?.text).toContain('ещё 60 мин')
    await ui.unmount()
  }
})

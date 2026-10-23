import { describe, expect, it } from 'vitest'
import { rub } from './money'

describe('rub', () => {
  it('форматирует с разделителем тысяч и знаком рубля', () => {
    expect(rub(250)).toBe('250 ₽')
    expect(rub(1250).replace(/\u00a0/g, ' ')).toBe('1 250 ₽')
  })
})

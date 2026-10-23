import { describe, expect, it } from 'vitest'
import { ApiError } from './apiError'
import { orderErrorText } from './orderError'

describe('orderErrorText', () => {
  it('устаревшая сессия: не про интернет, а про перезапуск', () => {
    expect(orderErrorText(new ApiError(401, 'bad init data'))).toContain('откройте заново')
  })
  it('прошедшее время и обычный сбой связи', () => {
    expect(orderErrorText(new ApiError(400, 'pickup time passed'))).toContain('уже прошло')
    expect(orderErrorText(new TypeError('Failed to fetch'))).toContain('интернет')
  })
})

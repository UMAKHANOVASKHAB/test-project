import { describe, expect, it } from 'vitest'
import { ApiError, orderErrorText } from './errors'

describe('orderErrorText', () => {
  it('сбой связи: предлагаем повторить', () => {
    expect(orderErrorText(new TypeError('Failed to fetch'))).toContain('Проверьте интернет')
  })
  it('ответы сервера объясняют, что делать, а не «проверьте интернет»', () => {
    expect(orderErrorText(new ApiError(401, 'bad init data'))).toContain('откройте его снова')
    expect(orderErrorText(new ApiError(429, 'too many orders'))).toContain('Подождите')
    expect(orderErrorText(new ApiError(400, 'pickup time passed'))).toContain('Выберите другое время')
    expect(orderErrorText(new ApiError(400, 'shop closed'))).toContain('не работает')
    expect(orderErrorText(new ApiError(400, 'unknown item'))).not.toContain('интернет')
    expect(orderErrorText(new ApiError(500, 'server error'))).toContain('сбой')
  })
})

import { describe, expect, it } from 'vitest'
import { pickupSlots } from './slots'

const at = (h: number, m: number) => new Date(2026, 8, 27, h, m, 0, 0)

describe('pickupSlots', () => {
  it('первый слот не раньше чем через 10 минут, округлён вверх до 15', () => {
    const s = pickupSlots(at(12, 3), '08:00', '23:00')
    expect(s[0]).toBe('12:15')
  })

  it('если сейчас ровно на границе шага, следующий слот через шаг', () => {
    const s = pickupSlots(at(12, 5), '08:00', '23:00')
    expect(s[0]).toBe('12:15')
    expect(s[1]).toBe('12:30')
  })

  it('до открытия первый слот равен времени открытия', () => {
    const s = pickupSlots(at(6, 0), '08:00', '23:00')
    expect(s[0]).toBe('08:00')
  })

  it('последний слот не позже закрытия', () => {
    const s = pickupSlots(at(22, 20), '08:00', '23:00')
    expect(s).toEqual(['22:30', '22:45', '23:00'])
  })

  it('после закрытия слотов нет', () => {
    expect(pickupSlots(at(23, 10), '08:00', '23:00')).toEqual([])
  })
})

describe('pickupSlots по времени кофейни', () => {
  it('телефон на другом поясе получает слоты по Москве', () => {
    // 09:03 UTC это 12:03 в Москве, у гостя на телефоне может быть что угодно
    const s = pickupSlots(new Date('2026-11-01T09:03:00Z'), '08:00', '23:00', 15, 10, 'Europe/Moscow')
    expect(s[0]).toBe('12:15')
    expect(s.at(-1)).toBe('23:00')
  })
  it('поздно вечером по Москве слотов нет, даже если на телефоне день', () => {
    expect(pickupSlots(new Date('2026-11-01T20:30:00Z'), '08:00', '23:00', 15, 10, 'Europe/Moscow')).toEqual([])
  })
})

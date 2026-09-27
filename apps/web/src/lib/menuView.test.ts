import { describe, expect, it } from 'vitest'
import { priceLabel, sharedVolume, volumeLabel } from './menuView'
import type { MenuItem } from '../types/menu'

const item = (id: string, variants: { label: string; price: number }[]): MenuItem => ({ id, category: 'c', title: id, variants })

describe('menuView', () => {
  it('общий объём раздела, если у всех один и тот же', () => {
    expect(sharedVolume([item('a', [{ label: '300 мл', price: 250 }]), item('b', [{ label: '300 мл', price: 300 }])])).toBe('300 мл')
  })
  it('нет общего объёма, если объёмы разные', () => {
    expect(sharedVolume([item('a', [{ label: '40 мл', price: 180 }]), item('b', [{ label: '200 мл', price: 180 }])])).toBeNull()
  })
  it('у еды объёма нет', () => {
    expect(sharedVolume([item('a', [{ label: '', price: 490 }])])).toBeNull()
  })
  it('цена с двумя размерами через косую черту', () => {
    expect(priceLabel(item('a', [{ label: '200 мл', price: 200 }, { label: '300 мл', price: 250 }]))).toBe('200/250 ₽')
  })
  it('объём с двумя размерами', () => {
    expect(volumeLabel(item('a', [{ label: '200 мл', price: 200 }, { label: '300 мл', price: 250 }]))).toBe('200/300 мл')
  })
  it('варианты без мл (курица/креветки) объёмом не считаются', () => {
    expect(volumeLabel(item('a', [{ label: 'курица', price: 520 }, { label: 'креветки', price: 540 }]))).toBe('')
  })
})

import { useEffect, useRef, useState } from 'react'
import { rub } from '../lib/money'
import { showBackButton } from '../lib/telegram'
import type { Addon, MenuItem, Variant } from '../types/menu'

export function VariantSheet({
  item,
  addons,
  onAdd,
  onClose,
}: {
  item: MenuItem
  addons: Addon[]
  onAdd: (variant: Variant, addons: Addon[]) => void
  onClose: () => void
}) {
  const [variant, setVariant] = useState<Variant>(item.variants[0])
  const [picked, setPicked] = useState<Addon[]>([])
  const total = variant.price + picked.reduce((s, a) => s + a.price, 0)

  const sheetRef = useRef<HTMLDivElement>(null)

  // Закрыть можно кнопкой «Назад» Telegram и клавишей Esc, фокус сразу внутри шторки
  useEffect(() => showBackButton(onClose), [onClose])
  useEffect(() => {
    sheetRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (a: Addon) =>
    setPicked((p) => (p.some((x) => x.id === a.id) ? p.filter((x) => x.id !== a.id) : [...p, a]))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" aria-hidden />
        <div className="sheet__title" id="sheet-title">{item.title}</div>
        {item.desc && <div className="sheet__desc">{item.desc}</div>}

        {item.variants.length > 1 && (
          <div className="sheet__group">
            <div className="sheet__label">Размер</div>
            <div className="chips">
              {item.variants.map((v) => (
                <button
                  key={v.label}
                  className={`chip ${v.label === variant.label ? 'is-active' : ''}`}
                  aria-pressed={v.label === variant.label}
                  onClick={() => setVariant(v)}
                >
                  {v.label} · {rub(v.price)}
                </button>
              ))}
            </div>
          </div>
        )}

        {addons.length > 0 && (
          <div className="sheet__group">
            <div className="sheet__label">Добавки</div>
            <div className="chips">
              {addons.map((a) => (
                <button
                  key={a.id}
                  className={`chip ${picked.some((x) => x.id === a.id) ? 'is-active' : ''}`}
                  aria-pressed={picked.some((x) => x.id === a.id)}
                  onClick={() => toggle(a)}
                >
                  {a.title} +{rub(a.price)}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn--primary" onClick={() => onAdd(variant, picked)}>
          Добавить · {rub(total)}
        </button>
      </div>
    </div>
  )
}

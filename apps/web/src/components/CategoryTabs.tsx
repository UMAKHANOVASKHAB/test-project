import { useEffect, useRef } from 'react'
import type { Category } from '../types/menu'

// Во вкладке короткое имя: «Завтраки + фреш + кофе» → «Завтраки»
const short = (title: string) => title.split(' + ')[0]

export function CategoryTabs({
  categories,
  active,
  onPick,
}: {
  categories: Category[]
  active: string
  onPick: (id: string) => void
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Активная вкладка всегда видна в полосе
  useEffect(() => {
    refs.current[active]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <div className="tabs">
      {categories.map((c) => (
        <button
          key={c.id}
          ref={(el) => (refs.current[c.id] = el)}
          className={`tab ${active === c.id ? 'is-active' : ''}`}
          onClick={() => onPick(c.id)}
        >
          {short(c.title)}
        </button>
      ))}
    </div>
  )
}

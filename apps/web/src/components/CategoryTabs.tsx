import type { Category } from '../types/menu'

export function CategoryTabs({
  categories,
  active,
  onPick,
}: {
  categories: Category[]
  active: string
  onPick: (id: string) => void
}) {
  return (
    <div className="tabs">
      {categories.map((c) => (
        <button key={c.id} className={`tab ${active === c.id ? 'is-active' : ''}`} onClick={() => onPick(c.id)}>
          <span>{c.emoji}</span> {c.title}
        </button>
      ))}
    </div>
  )
}

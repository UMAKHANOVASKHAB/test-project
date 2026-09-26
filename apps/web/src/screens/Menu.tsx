import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { CategoryTabs } from '../components/CategoryTabs'
import { ItemCard } from '../components/ItemCard'
import { VariantSheet } from '../components/VariantSheet'
import { useCart } from '../state/CartContext'
import { haptic } from '../lib/telegram'
import type { Addon, Menu, MenuItem, Variant } from '../types/menu'

export function MenuScreen({ menu }: { menu: Menu }) {
  const { dispatch } = useCart()
  const [active, setActive] = useState(menu.categories[0].id)
  const [picking, setPicking] = useState<MenuItem | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const byCategory = useMemo(() => {
    const m = new Map<string, MenuItem[]>()
    for (const it of menu.items) m.set(it.category, [...(m.get(it.category) ?? []), it])
    return m
  }, [menu])

  const addonsFor = (item: MenuItem): Addon[] => menu.addons.filter((a) => a.forCategories.includes(item.category))

  // Подсветка активной категории при прокрутке
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive((visible[0].target as HTMLElement).dataset.cat!)
      },
      { rootMargin: '-120px 0px -70% 0px' },
    )
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const quickAdd = (item: MenuItem) => {
    const addons = addonsFor(item)
    if (item.variants.length > 1 || addons.length > 0) {
      setPicking(item)
      return
    }
    add(item, item.variants[0], [])
  }

  const add = (item: MenuItem, variant: Variant, addons: Addon[]) => {
    dispatch({ type: 'add', item, variant, addons })
    haptic('light')
    setPicking(null)
  }

  return (
    <div className="screen">
      <Header shop={menu.shop} />
      <div className="tabs-wrap">
        <CategoryTabs categories={menu.categories} active={active} onPick={scrollTo} />
      </div>
      {menu.categories.map((c) => (
        <section key={c.id} data-cat={c.id} ref={(el) => (sectionRefs.current[c.id] = el)} className="section">
          <h2 className="section__title">
            {c.emoji} {c.title}
          </h2>
          {(byCategory.get(c.id) ?? []).map((it) => (
            <ItemCard key={it.id} item={it} emoji={c.emoji} onAdd={() => quickAdd(it)} />
          ))}
        </section>
      ))}
      <div className="spacer" />
      {picking && <VariantSheet item={picking} addons={addonsFor(picking)} onAdd={(v, a) => add(picking, v, a)} onClose={() => setPicking(null)} />}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { CategoryTabs } from '../components/CategoryTabs'
import { ItemRow } from '../components/ItemRow'
import { VariantSheet } from '../components/VariantSheet'
import { useCart } from '../state/CartContext'
import { haptic } from '../lib/telegram'
import { sharedVolume } from '../lib/menuView'
import type { Addon, Menu, MenuItem, Variant } from '../types/menu'

export function MenuScreen({ menu }: { menu: Menu }) {
  const { cart, dispatch } = useCart()
  const [group, setGroup] = useState(menu.groups[0].id)
  const categories = useMemo(() => menu.categories.filter((c) => c.group === group), [menu, group])
  const [active, setActive] = useState(categories[0].id)
  const [picking, setPicking] = useState<MenuItem | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  // стабильная функция: иначе шторка на каждой перерисовке заново забирала бы фокус и кнопку «Назад»
  const closeSheet = useCallback(() => setPicking(null), [])

  const byCategory = useMemo(() => {
    const m = new Map<string, MenuItem[]>()
    for (const it of menu.items) m.set(it.category, [...(m.get(it.category) ?? []), it])
    return m
  }, [menu])

  const countInCart = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of cart.lines) m.set(l.item.id, (m.get(l.item.id) ?? 0) + l.qty)
    return m
  }, [cart])

  const addonsFor = (item: MenuItem): Addon[] => menu.addons.filter((a) => a.forCategories.includes(item.category))

  // Подсветка активного раздела при прокрутке
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive((visible[0].target as HTMLElement).dataset.cat!)
      },
      { rootMargin: '-140px 0px -70% 0px' },
    )
    categories.forEach((c) => {
      const el = sectionRefs.current[c.id]
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [categories])

  const switchGroup = (id: string) => {
    if (id === group) return
    setGroup(id)
    setActive(menu.categories.find((c) => c.group === id)!.id)
    window.scrollTo({ top: 0 })
    haptic('light')
  }

  const scrollTo = (id: string) => {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const quickAdd = (item: MenuItem) => {
    if (item.variants.length > 1 || addonsFor(item).length > 0) {
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
        <div className="groups" role="tablist">
          {menu.groups.map((g) => (
            <button key={g.id} role="tab" aria-selected={g.id === group} className={`group ${g.id === group ? 'is-active' : ''}`} onClick={() => switchGroup(g.id)}>
              {g.title}
            </button>
          ))}
        </div>
        <CategoryTabs categories={categories} active={active} onPick={scrollTo} />
      </div>
      {categories.map((c) => {
        const items = byCategory.get(c.id) ?? []
        const shared = sharedVolume(items)
        return (
          <section key={c.id} data-cat={c.id} ref={(el) => (sectionRefs.current[c.id] = el)} className="section">
            <h2 className="section__title">
              {c.title}
              {shared && <span className="section__vol"> {shared}</span>}
            </h2>
            {items.map((it) => (
              <ItemRow key={it.id} item={it} showVolume={!shared} inCart={countInCart.get(it.id) ?? 0} onAdd={() => quickAdd(it)} />
            ))}
            {c.id === 'tea' && <p className="section__note">Добавка к чаю: +30 ₽</p>}
          </section>
        )
      })}
      <div className="spacer" />
      {picking && <VariantSheet item={picking} addons={addonsFor(picking)} onAdd={(v, a) => add(picking, v, a)} onClose={closeSheet} />}
    </div>
  )
}

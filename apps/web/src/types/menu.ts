export interface Variant {
  label: string
  price: number // рубли
}

export interface MenuItem {
  id: string
  category: string
  title: string
  desc?: string
  hit?: boolean
  cold?: boolean
  variants: Variant[]
}

export interface Category {
  id: string
  title: string
  group: string
}

export interface Group {
  id: string
  title: string
}

export interface Addon {
  id: string
  title: string
  price: number
  forCategories: string[]
}

export interface Shop {
  name: string
  address: string
  phone?: string
  currency: string
  loyalty: { stampsForFree: number; countsCategories: string[] }
  hours: { open: string; close: string }
  pickupStepMin: number
}

export interface Menu {
  shop: Shop
  groups: Group[]
  categories: Category[]
  addons: Addon[]
  items: MenuItem[]
}

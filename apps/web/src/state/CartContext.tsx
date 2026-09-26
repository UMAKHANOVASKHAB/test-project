import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { cartReducer, emptyCart, type CartAction, type CartState } from './cart'

const Ctx = createContext<{ cart: CartState; dispatch: Dispatch<CartAction> } | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, emptyCart)
  return <Ctx.Provider value={{ cart, dispatch }}>{children}</Ctx.Provider>
}

export function useCart() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart вне CartProvider')
  return v
}

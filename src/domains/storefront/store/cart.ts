import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  product_id: string
  variant_id?: string
  name: string
  variant_name?: string
  unit_price: number
  quantity: number
  image_url?: string
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (newItem) => set((state) => {
        const quantity = newItem.quantity || 1
        const existingItemIndex = state.items.findIndex(
          (item) => item.product_id === newItem.product_id && item.variant_id === newItem.variant_id
        )

        if (existingItemIndex >= 0) {
          const updatedItems = [...state.items]
          updatedItems[existingItemIndex].quantity += quantity
          return { items: updatedItems }
        }

        return { items: [...state.items, { ...newItem, quantity }] }
      }),

      removeItem: (productId, variantId) => set((state) => ({
        items: state.items.filter(
          (item) => !(item.product_id === productId && item.variant_id === variantId)
        )
      })),

      updateQuantity: (productId, quantity, variantId) => set((state) => {
        if (quantity <= 0) {
          return {
            items: state.items.filter(
              (item) => !(item.product_id === productId && item.variant_id === variantId)
            )
          }
        }
        
        return {
          items: state.items.map((item) => {
            if (item.product_id === productId && item.variant_id === variantId) {
              return { ...item, quantity }
            }
            return item
          })
        }
      }),

      clearCart: () => set({ items: [] })
    }),
    {
      name: 'biztrack-cart-storage',
    }
  )
)

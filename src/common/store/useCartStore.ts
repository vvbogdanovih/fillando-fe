import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'
import { httpService } from '../services/http.service'
import { API_URLS } from '../constants'
import { useAuthStore } from './useAuthStore'

export interface CartVariant {
	name: string
	slug: string
	price: number
	stock: number
	thumbnail: string | null
	v_value: string | null
}

export interface CartItem {
	variant_id: string
	quantity: number
	added_at: string
	variant: CartVariant
}

interface CartResponse {
	items: CartItem[]
	removed_items: string[]
}

export interface GuestItemMeta {
	name: string
	price: number
	thumbnail: string | null
	slug: string
}

export interface GuestItem {
	variant_id: string
	quantity: number
	_meta?: GuestItemMeta
}

interface CartStore {
	items: CartItem[]
	isLoading: boolean
	guestItems: GuestItem[]
	isOpen: boolean

	fetchCart: () => Promise<void>
	addItem: (variantId: string, quantity: number, meta?: GuestItemMeta) => Promise<void>
	updateQuantity: (variantId: string, quantity: number) => Promise<void>
	removeItem: (variantId: string) => Promise<void>
	removeGuestItem: (variantId: string) => void
	setGuestItemQuantity: (variantId: string, quantity: number) => void
	clearCart: () => Promise<void>
	/** Clears server cart (auth) or guest cart (local) after a successful order. */
	clearAfterOrder: () => Promise<void>
	mergeAndSync: () => Promise<void>
	resetServerCart: () => void
	openCart: () => void
	closeCart: () => void
}

const applyCartResponse = (response: CartResponse, set: (partial: Partial<CartStore>) => void) => {
	if (response.removed_items.length > 0) {
		toast.error('Деякі товари видалено з кошика, бо їх більше немає в наявності.')
	}
	set({ items: response.items })
}

export const useCartStore = create<CartStore>()(
	persist(
		(set, get) => ({
			items: [],
			isLoading: false,
			guestItems: [],
			isOpen: false,

			openCart: () => set({ isOpen: true }),
			closeCart: () => set({ isOpen: false }),

			fetchCart: async () => {
				set({ isLoading: true })
				try {
					const res = await httpService.get<CartResponse, unknown>(API_URLS.CART.BASE, {
						skipErrorToast: true
					})
					applyCartResponse(res, set)
				} catch {
					// Silent — user may not be authenticated or cart may be empty
				} finally {
					set({ isLoading: false })
				}
			},

			addItem: async (variantId, quantity, meta) => {
				const isAuth = useAuthStore.getState().isUserLoggedIn()

				if (!isAuth) {
					const guestItems = get().guestItems
					const existing = guestItems.find(i => i.variant_id === variantId)
					if (existing) {
						set({
							guestItems: guestItems.map(i =>
								i.variant_id === variantId
									? {
											...i,
											quantity: i.quantity + quantity,
											_meta: meta ?? i._meta
										}
									: i
							)
						})
					} else {
						set({
							guestItems: [
								...guestItems,
								{ variant_id: variantId, quantity, _meta: meta }
							]
						})
					}
					return
				}

				// Throws on error (skipErrorToast: true) — callers handle display
				const res = await httpService.post<
					CartResponse,
					{ variant_id: string; quantity: number }
				>(
					API_URLS.CART.ITEMS,
					{ variant_id: variantId, quantity },
					{ skipErrorToast: true }
				)
				applyCartResponse(res, set)
			},

			updateQuantity: async (variantId, quantity) => {
				const res = await httpService.patch<CartResponse, { quantity: number }>(
					API_URLS.CART.ITEM(variantId),
					{ quantity }
				)
				applyCartResponse(res, set)
			},

			removeItem: async variantId => {
				const res = await httpService.delete<CartResponse, unknown>(
					API_URLS.CART.ITEM(variantId)
				)
				applyCartResponse(res, set)
			},

			removeGuestItem: variantId => {
				set({ guestItems: get().guestItems.filter(i => i.variant_id !== variantId) })
			},

			setGuestItemQuantity: (variantId, quantity) => {
				set({
					guestItems: get().guestItems.map(i =>
						i.variant_id === variantId ? { ...i, quantity } : i
					)
				})
			},

			clearCart: async () => {
				const res = await httpService.delete<CartResponse, unknown>(API_URLS.CART.BASE)
				applyCartResponse(res, set)
			},

			clearAfterOrder: async () => {
				if (useAuthStore.getState().isUserLoggedIn()) {
					try {
						const res = await httpService.delete<CartResponse, unknown>(
							API_URLS.CART.BASE,
							{ skipErrorToast: true }
						)
						applyCartResponse(res, set)
					} catch {
						set({ items: [] })
					}
				} else {
					set({ guestItems: [] })
				}
			},

			mergeAndSync: async () => {
				const { guestItems } = get()
				try {
					const res = await httpService.post<CartResponse, { items: GuestItem[] }>(
						API_URLS.CART.MERGE,
						{ items: guestItems }
					)
					applyCartResponse(res, set)
					set({ guestItems: [] })
				} catch {
					// Fallback: fetch server cart without merging
					await get().fetchCart()
				}
			},

			resetServerCart: () => {
				set({ items: [] })
			}
		}),
		{
			name: 'fillando-cart',
			partialize: state => ({ guestItems: state.guestItems })
		}
	)
)

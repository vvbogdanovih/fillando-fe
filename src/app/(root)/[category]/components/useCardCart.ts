'use client'

import { useState, type MouseEvent } from 'react'
import toast from 'react-hot-toast'
import type { CatalogItem } from '../catalog.api'
import { trackAddToCart } from '@/common/lib/ga4-events'
import { useCartStore } from '@/common/store/useCartStore'
import { mapCartErrorMessage } from '@/common/utils/cart-error.utils'
import { catalogItemName } from '@/common/utils/color.utils'
import { effectivePrice } from '@/common/utils/price.utils'

/**
 * «В кошик» of a card that stands for one SKU — the catalogue grid's and a strip's alike, so the
 * cart line and the `add_to_cart` event (F12) have one author. A SKU already in the cart opens the
 * cart instead of adding a second line.
 */
export function useCardCart(item: CatalogItem) {
	const addItem = useCartStore(s => s.addItem)
	const openCart = useCartStore(s => s.openCart)
	const inAuthCart = useCartStore(s => s.items.some(i => i.variant_id === item.id))
	const inGuestCart = useCartStore(s => s.guestItems.some(i => i.variant_id === item.id))
	const isInCart = inAuthCart || inGuestCart
	const [isAdding, setIsAdding] = useState(false)

	// «Чорний (Black)», the same string the product page shows and the same one it puts in the
	// cart — otherwise one variant reaches the basket under two different names.
	const displayName = catalogItemName(item)
	const isOutOfStock = (item.quantity ?? item.stock) <= 0

	const handleCartButton = async (e: MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		if (isInCart) {
			openCart()
			return
		}

		if (isAdding || isOutOfStock) return
		setIsAdding(true)
		try {
			await addItem(item.id, 1, {
				name: displayName,
				price: item.price,
				sale_price: item.sale_price ?? null,
				promo_ends_at: item.promo_ends_at ?? null,
				thumbnail: item.main_image,
				slug: item.slug,
				sku: item.sku
			})
			// The card's «У кошик» is an add to cart like the product page's (F12): it was missing.
			trackAddToCart({
				item_id: item.sku,
				item_name: displayName,
				price: effectivePrice(item),
				quantity: 1
			})
		} catch (err) {
			toast.error(mapCartErrorMessage(err instanceof Error ? err.message : undefined))
		} finally {
			setIsAdding(false)
		}
	}

	return { displayName, isInCart, isAdding, isOutOfStock, handleCartButton }
}

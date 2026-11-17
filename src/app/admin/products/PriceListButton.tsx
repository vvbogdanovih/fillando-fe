'use client'

import { useCategoryOptions } from '../categories/categories.queries'
import { PriceListModal } from './PriceListModal'

/**
 * The wholesale price list PDF with its own category list. The legacy products page passes its
 * already loaded categories to `PriceListModal`; the new catalogue workspace (TD-0013), which
 * replaces that page after bootstrap, renders this instead. `GET /categories/options` lists the
 * visible product categories of both contracts — the set the PDF reads — without their
 * characteristics, page by page (Plan-0010 D06).
 */
export function PriceListButton() {
	const { data: categories = [] } = useCategoryOptions()
	return <PriceListModal categories={categories} />
}

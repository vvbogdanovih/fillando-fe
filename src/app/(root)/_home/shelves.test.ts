import { describe, expect, it } from 'vitest'
import type { StripItem } from '../[category]/catalog.api'
import { SHELF_CARDS, dedupeShelves, isPickedList } from './shelves'

const items = (...products: string[]) =>
	products.map(id => ({ id: `sku-${id}`, product_id: id }) as unknown as StripItem)
const row = (id: string, products: string[], filters: Record<string, unknown> | null = null) => ({
	collection: { id, filters },
	items: items(...products)
})
const shown = (rows: { items: StripItem[] }[]) =>
	rows.map(shelf => shelf.items.map(item => item.product_id))

describe('dedupeShelves — no product twice on the home page (owner, 2026-11-14)', () => {
	it('skips what «Новинки» already shows and gives the next products, five at most', () => {
		const shelves = dedupeShelves(items('a', 'b', 'c'), [
			row('category', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
		])
		expect(shown(shelves)).toEqual([['d', 'e', 'f', 'g', 'h']])
		expect(shelves[0].items).toHaveLength(SHELF_CARDS)
	})

	it('skips what an earlier shelf shows, too', () => {
		const shelves = dedupeShelves(items('a'), [
			row('first', ['a', 'b', 'c']),
			row('second', ['b', 'c', 'd'])
		])
		expect(shown(shelves)).toEqual([['b', 'c'], ['d']])
	})

	it('shows a list the admin picked by hand as picked, and counts it as shown', () => {
		const shelves = dedupeShelves(items('a', 'b'), [
			row('picked', ['b', 'a', 'x'], { product_ids: ['b', 'a', 'x'] }),
			row('category', ['x', 'y'])
		])
		expect(shown(shelves)).toEqual([['b', 'a', 'x'], ['y']])
	})

	// Owner, 2026-11-15: a picked list is a row that scrolls, and the home page shows all of it.
	// Cut to the shelf's five, products 6–24 of the admin's list stood on no page at all.
	it('gives a list picked by hand whole, however long, and a category shelf its five', () => {
		const twelve = Array.from({ length: 12 }, (_, i) => `p${i}`)
		const shelves = dedupeShelves(items('p0', 'p1'), [
			row('picked', twelve, { product_ids: twelve }),
			// Everything the picked row shows counts as shown, its twelfth product too.
			row('category', ['p11', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'])
		])
		expect(shown(shelves)).toEqual([twelve, ['c1', 'c2', 'c3', 'c4', 'c5']])
	})

	it('knows a picked list by its `product_ids`, whatever else a collection carries', () => {
		expect(isPickedList({ filters: { product_ids: ['a'] } })).toBe(true)
		expect(isPickedList({ filters: { attributes: [] } })).toBe(false)
		expect(isPickedList({ filters: null })).toBe(false)
	})

	it('does not render a shelf with nothing new, nor an empty collection', () => {
		const shelves = dedupeShelves(items('a', 'b'), [
			row('repeats', ['a', 'b']),
			row('empty', []),
			row('fresh', ['c'])
		])
		expect(shelves.map(shelf => shelf.collection.id)).toEqual(['fresh'])
	})
})

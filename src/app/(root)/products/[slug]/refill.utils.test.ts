import { describe, expect, it } from 'vitest'
import { findSpooledSibling } from './refill.utils'
import type { PublicColor } from '@/common/utils/color.utils'

const sibling = (
	id: string,
	vValue: string | null,
	price: number,
	color: PublicColor | null = null
) => ({
	id,
	slug: id,
	name: id,
	price,
	v_value: vValue,
	color
})

/**
 * The shape production actually holds today: FL-000253 «Clear Безбарвний Refill» sits on Bambu
 * Lab PETG Translucent next to eight spooled colours, none of which carries a dictionary colour
 * yet. The list reaching the page is sorted with out-of-stock last, so the refill's own
 * counterpart — Clear, out of stock — arrives after every other colour.
 */
describe('findSpooledSibling', () => {
	const refill = { id: 'FL-000253', v_value: 'Clear Безбарвний Refill', color: null }

	it('matches the spool of the same colour, not whichever comes first', () => {
		const found = findSpooledSibling(refill, [
			sibling('FL-000252', 'Brown Коричневий', 1180),
			sibling('FL-000254', 'Gray Сірий', 1300),
			sibling('FL-000251', 'Clear Безбарвний', 1500)
		])

		expect(found?.id).toBe('FL-000251')
		expect(found?.price).toBe(1500)
	})

	it('shows nothing rather than a different colour when no spool matches', () => {
		const found = findSpooledSibling(refill, [
			sibling('FL-000252', 'Brown Коричневий', 1180),
			sibling('FL-000254', 'Gray Сірий', 1300)
		])

		expect(found).toBeUndefined()
	})

	it('never matches the refill against itself', () => {
		const found = findSpooledSibling(refill, [
			sibling('FL-000253', 'Clear Безбарвний Refill', 1450)
		])

		expect(found).toBeUndefined()
	})

	it('never matches another refill', () => {
		const found = findSpooledSibling(refill, [
			sibling('FL-000255', 'Clear Безбарвний Refill 2', 1400)
		])

		expect(found).toBeUndefined()
	})

	it('prefers the dictionary colour once both variants carry one', () => {
		const clear: PublicColor = {
			name_uk: 'Прозорий',
			name_en: 'Natural',
			family: 'transparent',
			hex_stops: ['#f5f0e6']
		}
		const brown: PublicColor = {
			name_uk: 'Коричневий',
			name_en: 'Brown',
			family: 'brown',
			hex_stops: ['#7b4b2a']
		}
		const found = findSpooledSibling({ ...refill, color: clear }, [
			sibling('brown', 'Brown', 1180, brown),
			sibling('clear', 'Natural', 1500, clear)
		])

		expect(found?.id).toBe('clear')
	})

	it('does not match on an empty value', () => {
		const found = findSpooledSibling({ id: 'r', v_value: 'Refill', color: null }, [
			sibling('s', '', 100)
		])

		expect(found).toBeUndefined()
	})
})

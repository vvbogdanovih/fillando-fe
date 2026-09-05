import { REFILL_VARIANT_PATTERN } from '@/common/constants/attribute-notes.constants'
import type { PublicColor } from '@/common/utils/color.utils'

interface SiblingLike {
	id: string
	slug: string
	name: string
	price: number
	v_value: string | null
	color: PublicColor | null
}

/**
 * The colour value with the refill marker taken out — «Clear Безбарвний Refill» → «Clear
 * Безбарвний». The same normalisation `split-refill-products.js` applies when it moves a refill
 * onto its own product, so the two agree on what "the same colour" means.
 */
const withoutRefillMarker = (value: string | null | undefined): string =>
	(value ?? '').replace(REFILL_VARIANT_PATTERN, '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * The spooled version of a refill among its own siblings — the shape of the data *before*
 * `split-refill-products.js` runs, where a refill is one variant among the spooled colours of
 * one product.
 *
 * It must be the same colour. The refill is skipped by the colour migration (its marker is
 * still in `v_value`), so there is no `color_id` to match on and the stripped value is the only
 * key available. Taking whichever spooled sibling comes first is worse than showing nothing: on
 * production data the list is sorted with out-of-stock last, which pushes the refill's own
 * counterpart behind every other colour, and the page would quote a different colour at a
 * different price — on the current catalogue, one *below* the refill's own, inverting the point
 * of the comparison.
 */
export const findSpooledSibling = (
	variant: { id: string; v_value: string | null; color: PublicColor | null },
	siblings: SiblingLike[]
): SiblingLike | undefined => {
	const target = withoutRefillMarker(variant.v_value)

	return siblings.find(sibling => {
		if (sibling.id === variant.id) return false
		if (REFILL_VARIANT_PATTERN.test(sibling.v_value ?? '')) return false
		// Once both carry a dictionary colour that is the stronger key; before the migration
		// neither does, and the stripped value is all there is.
		if (variant.color && sibling.color) {
			return sibling.color.name_en === variant.color.name_en
		}
		return withoutRefillMarker(sibling.v_value) === target && target.length > 0
	})
}

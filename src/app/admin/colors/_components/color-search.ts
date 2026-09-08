import { includesNormalized, normalizeSearchText } from '@/common/utils'
import { COLOR_FAMILY_LABELS, type AdminColor, type ColorFamily } from '../colors.schema'

/** Everything the search box matches against: both names, the address, the family both ways. */
export const colorSearchFields = (color: AdminColor): string[] => [
	color.name_uk,
	color.name_en,
	color.slug,
	color.family,
	COLOR_FAMILY_LABELS[color.family as ColorFamily] ?? ''
]

/**
 * Narrows the dictionary to the rows matching `query`. A blank query returns the input array
 * itself, so `visible === colors` reads as «no filter active».
 */
export const filterColors = (colors: AdminColor[], query: string): AdminColor[] => {
	const needle = normalizeSearchText(query)
	if (needle === '') return colors
	return colors.filter(color =>
		colorSearchFields(color).some(field => includesNormalized(field, needle))
	)
}

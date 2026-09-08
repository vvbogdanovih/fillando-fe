import { includesNormalized, normalizeSearchText } from '@/common/utils'
import { LANDING_STATUS_LABELS, type AdminLanding } from '../landings.schema'

/**
 * What the search box matches against. The public address shown in the table is built from the
 * category (`/filament/pla-silk`), which the list does not carry, so it matches on the landing's
 * own `slug` only — «pla-silk» finds it, «filament/pla-silk» does not.
 */
export const landingSearchFields = (landing: AdminLanding): string[] => [
	landing.h1,
	landing.title,
	landing.slug,
	landing.status,
	LANDING_STATUS_LABELS[landing.status] ?? ''
]

/** A blank query returns the input array itself, so `visible === landings` reads as «no filter». */
export const filterLandings = (landings: AdminLanding[], query: string): AdminLanding[] => {
	const needle = normalizeSearchText(query)
	if (needle === '') return landings
	return landings.filter(landing =>
		landingSearchFields(landing).some(field => includesNormalized(field, needle))
	)
}

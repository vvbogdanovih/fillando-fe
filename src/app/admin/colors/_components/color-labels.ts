import { pluralUk } from '@/common/utils'

/**
 * «N кольорів» in the Ukrainian the plural rules ask for. The dictionary caps stops at six, so
 * only 1..6 ever reach here, but the shared rule is used rather than a local special case.
 */
export const stopsLabel = (count: number): string =>
	`${count} ${pluralUk(count, 'колір', 'кольори', 'кольорів')}`

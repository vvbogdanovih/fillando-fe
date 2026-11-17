/**
 * Mirrors the page parsing in `listingIndexing`; used only to label the title. Its own module
 * because the landing route needs the very same numbering — `?page=2` is indexable and
 * self-canonical there too, so a title without the number gives two indexed URLs one heading.
 */
export function readPageNumber(value: string | string[] | undefined): number {
	const raw = Array.isArray(value) ? value[0] : value
	const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN
	return Number.isFinite(parsed) && parsed > 1 ? parsed : 1
}

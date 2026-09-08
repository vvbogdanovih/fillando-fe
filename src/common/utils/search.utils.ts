/**
 * Text normalisation for the admin search boxes.
 *
 * Mirrors `normalizeColorValue` in `fillando-be/scripts/fillando_v_2/seed-colors.js`, which is
 * the rule the colour dictionary itself is matched with: NFC, every apostrophe the data mixes
 * («М’ятний» / «М'ятний» / «Мʼятний») folded to one, the dash forms folded to one, whitespace
 * collapsed, case dropped. Keeping the two in step means a spelling the migration recognises is
 * also one the admin can type into the search box.
 */
const APOSTROPHES = /[‘’ʼʹ`´]/g
const DASHES = /[‐-―]/g

export const normalizeSearchText = (value: string): string =>
	value
		.normalize('NFC')
		.replace(APOSTROPHES, "'")
		.replace(DASHES, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase()

/** `needle` is already normalised; `haystack` is raw and may be missing. */
export const includesNormalized = (haystack: string | null | undefined, needle: string): boolean =>
	needle !== '' && normalizeSearchText(haystack ?? '').includes(needle)

/**
 * Text normalisation for the admin search boxes.
 *
 * Matches the normalisation used when the colour dictionary was populated: NFC, every
 * apostrophe the data mixes
 * («М’ятний» / «М'ятний» / «Мʼятний») folded to one, the dash forms folded to one, whitespace
 * collapsed, case dropped. Stored synonyms and admin search therefore accept the same
 * spellings, independently of the retired seed scripts.
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

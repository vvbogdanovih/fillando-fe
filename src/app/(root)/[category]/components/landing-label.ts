/**
 * The tile label: the H1 without a trailing mention of the category.
 *
 * «PLA філамент» in a category called «Філамент» is a tile that says «PLA» — which is what the
 * artboard shows and what fits a 5-across grid. Nothing else is guessed: an H1 the rule cannot
 * shorten («Філамент, що світиться») is printed whole rather than cut somewhere arbitrary. A
 * landing that wants a different short label needs a field of its own; there is none yet.
 */
export const shortLabel = (h1: string, categoryName: string): string => {
	const trimmed = h1
		.replace(new RegExp(`[\\s—–-]*${escapeRegExp(categoryName)}\\s*$`, 'i'), '')
		.trim()
	return trimmed.length > 0 ? trimmed : h1
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

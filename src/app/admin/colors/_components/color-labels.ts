/**
 * «N кольорів» in the Ukrainian the plural rules ask for. The dictionary caps stops at six, so
 * only 1..6 ever reach here: 1 «колір», 2–4 «кольори», 5–6 «кольорів».
 */
export const stopsLabel = (count: number): string => {
	if (count === 1) return '1 колір'
	return `${count} ${count < 5 ? 'кольори' : 'кольорів'}`
}

/**
 * Chart colours for the orders dashboard — one place, consumed by the charts, the heatmap and
 * the breakdown bars.
 *
 * The daily chart is the «emphasis» form: the series that matters (placed orders) in the brand
 * green, the context series (cancelled) in a de-emphasis gray. The gray sits under 3:1 on white,
 * which is why every chart carries a legend and a table twin rather than relying on the fill.
 * Magnitude (heatmap, breakdown shares) is one hue stepped light → dark; the `--chart-*` tokens
 * in `globals.css` are a multi-hue shadcn default and deliberately not used for it.
 */
export const SERIES = {
	/** `--primary-strong`: the brand green that is legible as text. */
	primary: '#008062',
	/** The best weekday's bar — the same hue, one step darker. */
	primaryStrong: '#00513e',
	muted: '#94a3b8'
} as const

/** Step 0 is «nothing» and recedes into the surface; 1–5 climb one hue. */
export const HEAT_STEPS = [
	'transparent',
	'#e6f5f0',
	'#b3e1d2',
	'#73c7ad',
	'#2ba37f',
	'#008062'
] as const

export const GRID_STROKE = '#e5e7eb'
/** The week-start hairline: one step darker than the grid, still recessive. */
export const WEEK_LINE = '#9ca3af'
/** Weekend band behind the bars — a wash, never a block. */
export const WEEKEND_FILL = '#f3f4f6'

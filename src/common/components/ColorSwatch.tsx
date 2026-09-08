import { cn } from '@/common/utils/shad-cn.utils'

export interface ColorSwatchProps {
	/** 1..6 ordered `#rrggbb` stops. Order matters: `hex_stops[0]` is the primary colour. */
	hexStops: string[]
	/** Only `transparent` and `multicolor` change the shape of the fill — see `swatchBackground`. */
	family?: string | null
	/** Rendered size in pixels. The dictionary caps stops at six so this stays readable. */
	size?: number
	className?: string
	title?: string
}

/**
 * The checkerboard that marks a translucent filament, per the target-state mock of the catalogue
 * filter and the admin colour table. Two fixed tones rather than the colour's own stops: the
 * point of the pattern is that no stop value can make `Прозорий` look like `Білий`.
 *
 * The tile carries a 2x2 checker, so a cell is half of it. The mock draws an 8px tile: 4px cells,
 * barely three per row inside a 14px circle whose corners the border radius clips — at that size
 * the pattern flattens back into the pale disc this branch exists to remove. 6px gives 3px cells,
 * four to five per row on the smallest chip, and still reads as a checker on the 56px preview.
 */
const TRANSPARENT_CHECKER = 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 6px 6px'

/**
 * The fill for a colour swatch, derived from the stops rather than from a separate flag
 * (TD-0002 §5.2.2):
 *
 * - one stop is a solid circle;
 * - two or more is a linear gradient, which reads as "this filament shifts between these";
 * - `multicolor` is a conic gradient, so a rainbow reads as a ring rather than a stripe — a
 *   linear one would just look like a badly chosen two-tone;
 * - `transparent` is a checkerboard, and it wins over the stop count.
 *
 * Exported separately so the storefront filter can paint its own markup with the same rule.
 */
export function swatchBackground(hexStops: string[], family?: string | null): string {
	// Family before the stops, unlike every other rule: `Natural` stores a single near-white stop
	// (`#E8E8E8`), so any fill derived from it lands next to `Білий` (`#F7F7F5`) at 16px in the
	// filter and is indistinguishable on the variant picker, where the chip is the only cue.
	if (family === 'transparent') return TRANSPARENT_CHECKER

	const stops = hexStops.filter(Boolean)
	if (stops.length === 0) return 'transparent'
	if (stops.length === 1) return stops[0]
	if (family === 'multicolor') return `conic-gradient(${stops.join(', ')}, ${stops[0]})`
	return `linear-gradient(135deg, ${stops.join(', ')})`
}

/**
 * A round colour chip. The border is not decoration: white and other near-paper colours would
 * otherwise be invisible against the panel.
 */
export function ColorSwatch({ hexStops, family, size = 24, className, title }: ColorSwatchProps) {
	return (
		<span
			role='img'
			aria-label={title ?? 'Колір'}
			title={title}
			className={cn('inline-block shrink-0 rounded-full border border-black/15', className)}
			style={{
				width: size,
				height: size,
				background: swatchBackground(hexStops, family)
			}}
		/>
	)
}

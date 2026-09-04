import { cn } from '@/common/utils/shad-cn.utils'

export interface ColorSwatchProps {
	/** 1..6 ordered `#rrggbb` stops. Order matters: `hex_stops[0]` is the primary colour. */
	hexStops: string[]
	/** Only `multicolor` changes the shape of the fill — see `swatchBackground`. */
	family?: string | null
	/** Rendered size in pixels. The dictionary caps stops at six so this stays readable. */
	size?: number
	className?: string
	title?: string
}

/**
 * The fill for a colour swatch, derived from the stops rather than from a separate flag
 * (TD-0002 §5.2.2):
 *
 * - one stop is a solid circle;
 * - two or more is a linear gradient, which reads as "this filament shifts between these";
 * - `multicolor` is a conic gradient, so a rainbow reads as a ring rather than a stripe — a
 *   linear one would just look like a badly chosen two-tone.
 *
 * Exported separately so the storefront filter can paint its own markup with the same rule.
 */
export function swatchBackground(hexStops: string[], family?: string | null): string {
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

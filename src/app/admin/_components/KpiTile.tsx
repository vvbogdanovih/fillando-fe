import { cn } from '@/common/utils/shad-cn.utils'

export interface KpiDelta {
	/** Change against the previous period; `null` when there was nothing to compare to. */
	percent: number | null
	/** Whether growth is good news (orders, revenue) or bad (cancellations). */
	upIsGood: boolean
	/** The printed form, e.g. «+12,5 %» or «+4 п.п.» — the caller owns the unit. */
	label: string
	/** Small muted line under the delta, e.g. «попередній період: 2 610 ₴». */
	previous?: string
}

export interface KpiTileProps {
	label: string
	/** Already formatted by the caller; a number is printed as is. */
	value: string | number
	/** Feed's semantics: `warn` / `bad` colour the value only when it is a positive number. */
	tone?: 'good' | 'warn' | 'bad'
	delta?: KpiDelta
	/** Small muted line under the label, e.g. «частка оплачених з усіх». */
	hint?: string
}

const deltaTone = (delta: KpiDelta): string => {
	if (delta.percent === null || delta.percent === 0) return 'text-gray-500'
	const good = delta.percent > 0 === delta.upIsGood
	return good ? 'text-emerald-700' : 'text-red-700'
}

/**
 * A stat tile: label, the figure, and optionally how it moved against the previous period.
 * Shared by the feed status page and the orders dashboard.
 */
export const KpiTile = ({ value, label, tone, delta, hint }: KpiTileProps) => {
	const positive = typeof value === 'number' ? value > 0 : true

	return (
		<div className='rounded-xl border border-gray-200 bg-gray-50 p-4'>
			<p
				className={cn(
					'text-3xl font-bold',
					typeof value === 'number' && 'tabular-nums',
					tone === 'good' && 'text-emerald-700',
					tone === 'warn' && positive && 'text-amber-700',
					tone === 'bad' && positive && 'text-red-700'
				)}
			>
				{value}
			</p>
			<p className='text-sm text-gray-500'>{label}</p>
			{hint && <p className='text-xs text-gray-400'>{hint}</p>}
			{delta && (
				<p
					className={cn('mt-2 text-sm font-medium tabular-nums', deltaTone(delta))}
					aria-label='Зміна проти попереднього періоду'
				>
					{delta.percent === null ? '—' : delta.label}
					{delta.previous && (
						<span className='ml-2 font-normal text-gray-400'>{delta.previous}</span>
					)}
				</p>
			)}
		</div>
	)
}

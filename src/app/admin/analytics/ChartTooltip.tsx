'use client'

interface TooltipRow {
	name?: string | number
	value?: string | number | ReadonlyArray<string | number>
	color?: string
	dataKey?: string | number
}

export interface ChartTooltipProps {
	active?: boolean
	payload?: ReadonlyArray<TooltipRow>
	label?: string | number
	/** How the x value reads in the header, e.g. a full date for a day key. */
	formatLabel?: (label: string | number) => string
	/** Per-series value formatting, keyed by `dataKey`. */
	formatValue?: (value: number, dataKey: string) => string
}

/**
 * One tooltip for every chart on the dashboard: the x value as a header, then every series at
 * that x with its swatch. Text wears text colours; the swatch carries the identity.
 */
export const ChartTooltip = ({
	active,
	payload,
	label,
	formatLabel,
	formatValue
}: ChartTooltipProps) => {
	if (!active || !payload || payload.length === 0 || label === undefined) return null

	return (
		<div className='rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-md'>
			<p className='mb-1 font-medium text-gray-900'>
				{formatLabel ? formatLabel(label) : String(label)}
			</p>
			<ul className='space-y-0.5'>
				{payload.map(row => {
					const raw = Array.isArray(row.value) ? row.value[0] : row.value
					const numeric = typeof raw === 'number' ? raw : Number(raw ?? 0)
					const key = String(row.dataKey ?? row.name ?? '')
					return (
						<li key={key} className='flex items-center gap-2 text-gray-700'>
							<span
								aria-hidden
								className='inline-block size-2.5 rounded-sm'
								style={{ background: row.color }}
							/>
							<span>{String(row.name ?? key)}</span>
							<span className='ml-auto pl-4 font-medium text-gray-900 tabular-nums'>
								{formatValue
									? formatValue(numeric, key)
									: numeric.toLocaleString('uk-UA')}
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

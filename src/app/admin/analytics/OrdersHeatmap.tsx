'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { HEAT_STEPS } from './analytics.constants'
import type { HeatmapCell } from './analytics.schema'
import {
	formatHour,
	heatmapGrid,
	heatmapMax,
	heatmapStep,
	ordersWord,
	weekdayShort
} from './analytics.utils'

interface OrdersHeatmapProps {
	cells: HeatmapCell[]
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/**
 * Weekday × hour, Kyiv time, every placed order (cancelled ones included — they were placed).
 * Plain CSS grid: a sequential ramp of one hue needs no chart library, and every cell carries its
 * reading in `aria-label`, so the colour is never the only way to read it.
 */
export const OrdersHeatmap = ({ cells }: OrdersHeatmapProps) => {
	const grid = heatmapGrid(cells)
	const max = heatmapMax(grid)

	return (
		<Card>
			<CardHeader className='space-y-1'>
				<CardTitle className='text-base'>Коли замовляють</CardTitle>
				<p className='text-sm text-gray-500'>
					День тижня × година оформлення, київський час.
				</p>
			</CardHeader>
			<CardContent>
				<div
					className='grid gap-0.5 text-xs text-gray-500'
					style={{ gridTemplateColumns: 'auto repeat(24, minmax(0, 1fr))' }}
					role='table'
					aria-label='Замовлення за днем тижня та годиною'
				>
					<div />
					{HOURS.map(hour => (
						<div key={hour} className='pb-1 text-center' aria-hidden>
							{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
						</div>
					))}
					{grid.map((row, weekdayIndex) => (
						<div key={weekdayIndex} role='row' className='contents'>
							<div className='pr-2 leading-5'>{weekdayShort(weekdayIndex + 1)}</div>
							{row.map((value, hour) => {
								const step = heatmapStep(value, max)
								const reading = `${weekdayShort(weekdayIndex + 1)}, ${formatHour(hour)} — ${value} ${ordersWord(value)}`
								return (
									<div
										key={hour}
										role='img'
										aria-label={reading}
										title={reading}
										data-step={step}
										className='min-h-5 rounded-sm border border-gray-100'
										style={{ background: HEAT_STEPS[step] }}
									/>
								)
							})}
						</div>
					))}
				</div>
				<div className='mt-3 flex items-center gap-2 text-xs text-gray-500'>
					<span>менше</span>
					{HEAT_STEPS.slice(1).map(colour => (
						<span
							key={colour}
							className='inline-block h-3 w-5 rounded-sm'
							style={{ background: colour }}
							aria-hidden
						/>
					))}
					<span>більше</span>
				</div>
			</CardContent>
		</Card>
	)
}

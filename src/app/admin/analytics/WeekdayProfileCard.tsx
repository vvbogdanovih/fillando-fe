'use client'

import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { formatUah } from '@/common/utils/price.utils'
import { ChartTooltip } from './ChartTooltip'
import { GRID_STROKE, SERIES } from './analytics.constants'
import type { WeekdayPoint } from './analytics.schema'
import {
	formatNumber,
	weekdayExtremes,
	weekdayLong,
	weekdaySentence,
	weekdayShort
} from './analytics.utils'

interface WeekdayProfileCardProps {
	rows: WeekdayPoint[]
}

const HEIGHT = 200

const axisTick = { fontSize: 12, fill: '#6b7280' }

/**
 * The block the ad budget is set from: average orders and average revenue per weekday, as two
 * small charts over one Пн–Нд axis (never a dual axis), with the answer spelled out in a
 * sentence above them and the figures in a table under them.
 */
export const WeekdayProfileCard = ({ rows }: WeekdayProfileCardProps) => {
	const data = [...rows]
		.sort((a, b) => a.weekday - b.weekday)
		.map(row => ({ ...row, label: weekdayShort(row.weekday) }))
	const extremes = weekdayExtremes(rows)

	const chart = (dataKey: 'avg_orders' | 'avg_revenue', name: string) => (
		<ResponsiveContainer
			width='100%'
			height={HEIGHT}
			initialDimension={{ width: 320, height: HEIGHT }}
		>
			<BarChart
				data={data}
				margin={{ top: 8, right: 8, left: dataKey === 'avg_revenue' ? 0 : -16, bottom: 0 }}
			>
				<CartesianGrid vertical={false} stroke={GRID_STROKE} />
				<XAxis dataKey='label' tickLine={false} axisLine={false} tick={axisTick} />
				<YAxis
					allowDecimals={dataKey === 'avg_orders'}
					width={dataKey === 'avg_revenue' ? 72 : undefined}
					tickFormatter={value =>
						dataKey === 'avg_revenue'
							? formatUah(Number(value))
							: formatNumber(Number(value))
					}
					tickLine={false}
					axisLine={false}
					tick={axisTick}
				/>
				<Tooltip
					cursor={{ fill: '#f3f4f6' }}
					content={
						<ChartTooltip
							formatLabel={label => {
								const row = data.find(point => point.label === label)
								return row ? weekdayLong(row.weekday) : String(label)
							}}
							formatValue={(value, key) =>
								key === 'avg_revenue'
									? formatUah(Math.round(value))
									: formatNumber(value)
							}
						/>
					}
				/>
				<Bar
					dataKey={dataKey}
					name={name}
					fill={SERIES.primary}
					maxBarSize={28}
					radius={[4, 4, 0, 0]}
					isAnimationActive={false}
				>
					{data.map(row => (
						<Cell
							key={row.weekday}
							fill={
								row.weekday === extremes?.best.weekday
									? SERIES.primaryStrong
									: SERIES.primary
							}
						/>
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	)

	return (
		<Card>
			<CardHeader className='space-y-1'>
				<CardTitle className='text-base'>Профіль тижня</CardTitle>
				<p className='text-sm text-gray-500'>
					Середнє на день для кожного дня тижня за період — нульові дні теж у знаменнику.
				</p>
			</CardHeader>
			<CardContent className='space-y-4'>
				<p className='text-sm text-gray-800' data-testid='weekday-sentence'>
					{extremes ? weekdaySentence(extremes) : 'Недостатньо даних для профілю тижня.'}
				</p>

				<div className='grid gap-6 md:grid-cols-2'>
					<div>
						<p className='mb-1 text-sm font-medium text-gray-700'>Замовлень на день</p>
						{chart('avg_orders', 'Замовлень на день')}
					</div>
					<div>
						<p className='mb-1 text-sm font-medium text-gray-700'>Виручка на день</p>
						{chart('avg_revenue', 'Виручка на день')}
					</div>
				</div>

				<details className='text-sm'>
					<summary className='cursor-pointer text-gray-600 select-none'>Таблиця</summary>
					<table className='mt-2 w-full text-sm'>
						<thead className='text-left text-gray-500'>
							<tr>
								<th className='py-1 pr-3 font-medium'>День</th>
								<th className='py-1 pr-3 font-medium'>Днів у періоді</th>
								<th className='py-1 pr-3 font-medium'>Замовлень</th>
								<th className='py-1 pr-3 font-medium'>Замовлень на день</th>
								<th className='py-1 pr-3 font-medium'>Виручка на день</th>
							</tr>
						</thead>
						<tbody className='tabular-nums'>
							{data.map(row => (
								<tr key={row.weekday} className='border-t border-gray-100'>
									<td className='py-1 pr-3'>{weekdayLong(row.weekday)}</td>
									<td className='py-1 pr-3'>{row.days_in_range}</td>
									<td className='py-1 pr-3'>{row.orders}</td>
									<td className='py-1 pr-3'>{formatNumber(row.avg_orders)}</td>
									<td className='py-1 pr-3'>
										{formatUah(Math.round(row.avg_revenue))}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			</CardContent>
		</Card>
	)
}

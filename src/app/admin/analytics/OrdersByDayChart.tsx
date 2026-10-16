'use client'

import { useId } from 'react'
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ReferenceArea,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Label } from '@/common/components/ui/label'
import { Switch } from '@/common/components/ui/switch'
import { formatUah } from '@/common/utils/price.utils'
import { ChartTooltip } from './ChartTooltip'
import { GRID_STROKE, SERIES, WEEKEND_FILL, WEEK_LINE } from './analytics.constants'
import type { DayPoint } from './analytics.schema'
import {
	formatDayFull,
	formatDayTick,
	formatDayWithWeekday,
	mondays,
	weekdayShort,
	weekendBands,
	weekStartTicks
} from './analytics.utils'

interface OrdersByDayChartProps {
	days: DayPoint[]
	paidOnly: boolean
	onPaidOnlyChange: (value: boolean) => void
}

const ORDERS_HEIGHT = 260
const REVENUE_HEIGHT = 160

/**
 * Orders per calendar day — the emphasis form: placed orders in the brand green, cancelled ones
 * beside them in gray (grouped, not stacked: a cancelled order is one of the placed ones).
 * Revenue is its own small chart under it on the same x axis, never a second y axis.
 */
export const OrdersByDayChart = ({ days, paidOnly, onPaidOnlyChange }: OrdersByDayChartProps) => {
	const switchId = useId()
	const primaryKey = paidOnly ? 'paid' : 'orders'
	const primaryName = paidOnly ? 'Оплачені' : 'Оформлені'
	const formatValue = (value: number, key: string) =>
		key === 'revenue' ? formatUah(value) : value.toLocaleString('uk-UA')
	// Week boundaries: ticks on the Mondays, a hairline where each week starts, the weekends
	// shaded — so «where is Monday» is read off the axis, not counted.
	const ticks = weekStartTicks(days)
	const weekStarts = mondays(days)
	const weekends = weekendBands(days)
	const weekMarks = (
		<>
			{weekends.map(([first, last]) => (
				<ReferenceArea
					key={`weekend-${first}`}
					x1={first}
					x2={last}
					fill={WEEKEND_FILL}
					fillOpacity={1}
					stroke='none'
					ifOverflow='visible'
				/>
			))}
			{weekStarts.map(day => (
				<ReferenceLine key={`monday-${day}`} x={day} stroke={WEEK_LINE} strokeWidth={1} />
			))}
		</>
	)

	return (
		<Card>
			<CardHeader className='flex flex-row flex-wrap items-center justify-between gap-3 space-y-0'>
				<div>
					<CardTitle className='text-base'>Замовлення по днях</CardTitle>
					<p className='text-sm text-gray-500'>
						За датою оформлення, київський час. Лінія — початок тижня (понеділок), сіра
						смуга — вихідні; скасовані — окремим стовпчиком.
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<Switch id={switchId} checked={paidOnly} onCheckedChange={onPaidOnlyChange} />
					<Label htmlFor={switchId}>Лише оплачені</Label>
				</div>
			</CardHeader>
			<CardContent className='space-y-4'>
				<ResponsiveContainer
					width='100%'
					height={ORDERS_HEIGHT}
					initialDimension={{ width: 640, height: ORDERS_HEIGHT }}
				>
					<BarChart
						data={days}
						barGap={2}
						margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
					>
						<CartesianGrid vertical={false} stroke={GRID_STROKE} />
						{weekMarks}
						<XAxis
							dataKey='day'
							ticks={ticks}
							interval={0}
							tickFormatter={formatDayTick}
							minTickGap={8}
							tickLine={false}
							axisLine={false}
							tick={{ fontSize: 12, fill: '#6b7280' }}
						/>
						<YAxis
							allowDecimals={false}
							tickLine={false}
							axisLine={false}
							tick={{ fontSize: 12, fill: '#6b7280' }}
						/>
						<Tooltip
							cursor={{ fill: '#f3f4f6' }}
							content={
								<ChartTooltip
									formatLabel={l => formatDayWithWeekday(String(l))}
									formatValue={formatValue}
								/>
							}
						/>
						<Legend iconType='square' iconSize={10} wrapperStyle={{ fontSize: 12 }} />
						<Bar
							dataKey={primaryKey}
							name={primaryName}
							fill={SERIES.primary}
							maxBarSize={24}
							radius={[4, 4, 0, 0]}
							isAnimationActive={false}
						/>
						<Bar
							dataKey='cancelled'
							name='Скасовані'
							fill={SERIES.muted}
							maxBarSize={24}
							radius={[4, 4, 0, 0]}
							isAnimationActive={false}
						/>
					</BarChart>
				</ResponsiveContainer>

				<div>
					<p className='mb-1 text-sm font-medium text-gray-700'>Виручка по днях</p>
					<ResponsiveContainer
						width='100%'
						height={REVENUE_HEIGHT}
						initialDimension={{ width: 640, height: REVENUE_HEIGHT }}
					>
						<BarChart data={days} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
							<CartesianGrid vertical={false} stroke={GRID_STROKE} />
							{weekMarks}
							<XAxis
								dataKey='day'
								ticks={ticks}
								interval={0}
								tickFormatter={formatDayTick}
								minTickGap={8}
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 12, fill: '#6b7280' }}
							/>
							<YAxis
								tickFormatter={value => formatUah(Number(value))}
								width={72}
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 12, fill: '#6b7280' }}
							/>
							<Tooltip
								cursor={{ fill: '#f3f4f6' }}
								content={
									<ChartTooltip
										formatLabel={l => formatDayWithWeekday(String(l))}
										formatValue={formatValue}
									/>
								}
							/>
							<Bar
								dataKey='revenue'
								name='Виручка'
								fill={SERIES.primary}
								maxBarSize={24}
								radius={[4, 4, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>

				<details className='text-sm'>
					<summary className='cursor-pointer text-gray-600 select-none'>
						Таблиця по днях
					</summary>
					<div className='mt-2 max-h-72 overflow-auto'>
						<table className='w-full text-sm'>
							<thead className='text-left text-gray-500'>
								<tr>
									<th className='py-1 pr-3 font-medium'>Дата</th>
									<th className='py-1 pr-3 font-medium'>День</th>
									<th className='py-1 pr-3 font-medium'>Оформлені</th>
									<th className='py-1 pr-3 font-medium'>Оплачені</th>
									<th className='py-1 pr-3 font-medium'>Скасовані</th>
									<th className='py-1 pr-3 font-medium'>Виручка</th>
								</tr>
							</thead>
							<tbody className='tabular-nums'>
								{days.map(day => (
									<tr key={day.day} className='border-t border-gray-100'>
										<td className='py-1 pr-3'>{formatDayFull(day.day)}</td>
										<td className='py-1 pr-3'>{weekdayShort(day.weekday)}</td>
										<td className='py-1 pr-3'>{day.orders}</td>
										<td className='py-1 pr-3'>{day.paid}</td>
										<td className='py-1 pr-3'>{day.cancelled}</td>
										<td className='py-1 pr-3'>{formatUah(day.revenue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</details>
			</CardContent>
		</Card>
	)
}

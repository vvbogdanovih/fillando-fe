'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { formatUah } from '@/common/utils/price.utils'
import { SERIES } from './analytics.constants'
import type { BreakdownRow } from './analytics.schema'
import {
	breakdownLabel,
	formatPercent,
	share,
	sortBreakdown,
	type BreakdownDimension
} from './analytics.utils'

interface BreakdownCardProps {
	title: string
	dimension: BreakdownDimension
	rows: BreakdownRow[]
}

/** One dimension's share of the period's orders: a label, a bar for the share, the figures. */
export const BreakdownCard = ({ title, dimension, rows }: BreakdownCardProps) => {
	const sorted = sortBreakdown(rows)
	const total = sorted.reduce((acc, row) => acc + row.orders, 0)

	return (
		<Card>
			<CardHeader className='pb-3'>
				<CardTitle className='text-base'>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className='space-y-2 text-sm'>
					{sorted.map(row => {
						const percent = share(row.orders, total)
						return (
							<li key={row.key}>
								<div className='flex items-baseline justify-between gap-3'>
									<span className='text-gray-800'>
										{breakdownLabel(dimension, row.key)}
									</span>
									<span className='text-gray-600 tabular-nums'>
										{row.orders} · {formatPercent(percent, 0)} ·{' '}
										{formatUah(row.revenue)}
									</span>
								</div>
								<div
									className='mt-1 h-1.5 w-full rounded-full bg-gray-100'
									aria-hidden
								>
									<div
										className='h-1.5 rounded-full'
										style={{ width: `${percent}%`, background: SERIES.primary }}
									/>
								</div>
							</li>
						)
					})}
				</ul>
			</CardContent>
		</Card>
	)
}

'use client'

import { formatUah } from '@/common/utils/price.utils'
import { KpiTile, type KpiDelta } from '../_components/KpiTile'
import type { OrderStatsTotals } from './analytics.schema'
import { deltaPercent, formatPercent, formatSignedPercent, paidShare } from './analytics.utils'

interface KpiRowProps {
	totals: OrderStatsTotals
	previous: OrderStatsTotals
}

const relative = (
	current: number,
	previous: number,
	upIsGood: boolean,
	printPrevious: (v: number) => string
): KpiDelta => {
	const percent = deltaPercent(current, previous)
	return {
		percent,
		upIsGood,
		label: percent === null ? '' : formatSignedPercent(percent),
		previous: `попередній період: ${printPrevious(previous)}`
	}
}

/** Five figures for the period, each against the period of the same length before it. */
export const KpiRow = ({ totals, previous }: KpiRowProps) => {
	const paid = paidShare(totals)
	const paidBefore = paidShare(previous)
	// A share moves in percentage points — «+4 п.п.», never «+25 %» for 16 % → 20 %.
	const paidDelta: KpiDelta = {
		percent: previous.orders === 0 ? null : Math.round((paid - paidBefore) * 10) / 10,
		upIsGood: true,
		label: formatSignedPercent(Math.round((paid - paidBefore) * 10) / 10, 'п.п.'),
		previous: `попередній період: ${formatPercent(paidBefore, 0)}`
	}

	return (
		<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5' data-testid='kpi-row'>
			<KpiTile
				label='Замовлень'
				value={totals.orders}
				delta={relative(totals.orders, previous.orders, true, String)}
			/>
			<KpiTile
				label='Виручка'
				value={formatUah(Math.round(totals.revenue))}
				hint='без скасованих, після знижок'
				delta={relative(totals.revenue, previous.revenue, true, v =>
					formatUah(Math.round(v))
				)}
			/>
			<KpiTile
				label='Середній чек'
				value={formatUah(Math.round(totals.avg_order_value))}
				delta={relative(totals.avg_order_value, previous.avg_order_value, true, v =>
					formatUah(Math.round(v))
				)}
			/>
			<KpiTile
				label='Частка оплачених'
				value={formatPercent(paid, 0)}
				hint={`${totals.paid} з ${totals.orders}`}
				delta={paidDelta}
			/>
			<KpiTile
				label='Скасовано'
				value={totals.cancelled}
				tone='bad'
				hint='скасовані, повернені, відшкодовані'
				delta={relative(totals.cancelled, previous.cancelled, false, String)}
			/>
		</div>
	)
}

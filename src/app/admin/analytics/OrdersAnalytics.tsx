'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button } from '@/common/components/ui/button'
import { cn } from '@/common/utils/shad-cn.utils'
import { analyticsApi } from './analytics.api'
import {
	analyticsQuery,
	formatPeriod,
	matchPreset,
	parseAnalyticsParams,
	todayKyiv,
	type AnalyticsPeriod
} from './analytics.utils'
import { BreakdownCard } from './BreakdownCard'
import { DashboardSkeleton } from './DashboardSkeleton'
import { KpiRow } from './KpiRow'
import { OrdersByDayChart } from './OrdersByDayChart'
import { OrdersHeatmap } from './OrdersHeatmap'
import { PeriodPicker } from './PeriodPicker'
import { TopProductsTable } from './TopProductsTable'
import { WeekdayProfileCard } from './WeekdayProfileCard'

/**
 * The orders dashboard. The period is the URL (`?from=&to=`), like the order list's filters;
 * «today» is read once per mount in Kyiv; `paidOnly` is screen state. A refetch keeps the
 * previous figures on screen, dimmed, instead of flashing a skeleton.
 */
export const OrdersAnalytics = () => {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const today = useMemo(() => todayKyiv(), [])
	const period = useMemo(
		() => parseAnalyticsParams(new URLSearchParams(searchParams.toString()), today),
		[searchParams, today]
	)
	const preset = matchPreset(period, today)
	const [paidOnly, setPaidOnly] = useState(false)

	const updatePeriod = (next: AnalyticsPeriod) => {
		router.replace(`${pathname}${analyticsQuery(next, today)}`, { scroll: false })
	}

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ['admin-order-stats', period.from, period.to],
		queryFn: () => analyticsApi.getOrderStats({ date_from: period.from, date_to: period.to }),
		placeholderData: keepPreviousData,
		staleTime: 60_000
	})

	const picker = (
		<PeriodPicker period={period} preset={preset} today={today} onChange={updatePeriod} />
	)

	if (isLoading) {
		return (
			<div className='space-y-4'>
				{picker}
				<DashboardSkeleton />
			</div>
		)
	}

	if (isError || !data) {
		return (
			<div className='space-y-4'>
				{picker}
				<div className='rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700'>
					<p>Не вдалося завантажити аналітику.</p>
					<Button
						className='mt-3'
						size='sm'
						variant='outline'
						onClick={() => void refetch()}
					>
						Спробувати знову
					</Button>
				</div>
			</div>
		)
	}

	const empty = data.totals.orders === 0 && data.previous_period_totals.orders === 0

	return (
		<div className='space-y-4'>
			{picker}
			<p className='text-sm text-gray-500'>
				{formatPeriod({ from: data.period.date_from, to: data.period.date_to })} · порівняно
				з попереднім періодом такої ж довжини (
				{formatPeriod({
					from: data.previous_period.date_from,
					to: data.previous_period.date_to
				})}
				). Дата — момент оформлення; усі замовлення магазину, не лише з реклами.
			</p>

			{empty ? (
				<div className='rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600'>
					За обраний період замовлень немає.
				</div>
			) : (
				<div className={cn('space-y-4 transition-opacity', isFetching && 'opacity-60')}>
					{/* The owner's question first: when do orders come in. Everything else is context. */}
					<OrdersByDayChart
						days={data.by_day}
						paidOnly={paidOnly}
						onPaidOnlyChange={setPaidOnly}
					/>
					<WeekdayProfileCard rows={data.by_weekday} />
					<OrdersHeatmap cells={data.heatmap} />

					<details className='group rounded-lg border border-gray-200 bg-white'>
						<summary className='cursor-pointer px-6 py-4 text-sm font-medium text-gray-700 select-none'>
							Підсумки, розрізи й топ товарів
						</summary>
						<div className='space-y-4 border-t border-gray-100 p-6'>
							<KpiRow totals={data.totals} previous={data.previous_period_totals} />
							<div className='grid gap-4 md:grid-cols-2'>
								<BreakdownCard
									title='Спосіб оплати'
									dimension='payment_method'
									rows={data.by_payment_method}
								/>
								<BreakdownCard
									title='Доставка'
									dimension='delivery_method'
									rows={data.by_delivery_method}
								/>
								<BreakdownCard
									title='Статус замовлення'
									dimension='order_status'
									rows={data.by_order_status}
								/>
								<BreakdownCard
									title='Статус оплати'
									dimension='payment_status'
									rows={data.by_payment_status}
								/>
							</div>
							<TopProductsTable
								byRevenue={data.top_products_by_revenue}
								byQuantity={data.top_products_by_quantity}
							/>
						</div>
					</details>
				</div>
			)}
		</div>
	)
}

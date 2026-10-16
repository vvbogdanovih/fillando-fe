'use client'

import { OrdersAnalytics } from './analytics/OrdersAnalytics'
import { NovaPostSyncSection } from './nova-post/NovaPostSyncSection'
import { PromSyncSection } from './prom/PromSyncSection'

export const Dashboard = () => {
	return (
		<div className='p-6'>
			<h1 className='text-2xl font-semibold text-gray-900'>Аналітика замовлень</h1>
			<p className='mt-2 text-gray-500'>
				Коли надходять замовлення — по днях, днях тижня й годинах, щоб ставити рекламний
				бюджет по днях. Підсумки й розрізи — нижче, згорнуті.
			</p>

			<section className='mt-6' aria-labelledby='admin-analytics-heading'>
				<h2 id='admin-analytics-heading' className='sr-only'>
					Статистика замовлень
				</h2>
				<OrdersAnalytics />
			</section>

			<section className='mt-10 space-y-4' aria-labelledby='admin-data-heading'>
				<h2 id='admin-data-heading' className='text-sm font-medium text-gray-700'>
					Дані та інтеграції
				</h2>
				<NovaPostSyncSection />
				<PromSyncSection />
			</section>
		</div>
	)
}

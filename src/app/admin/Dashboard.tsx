'use client'

import { NovaPostSyncSection } from './nova-post/NovaPostSyncSection'

export const Dashboard = () => {
	return (
		<div className='p-6'>
			<h1 className='text-2xl font-semibold text-gray-900'>Dashboard</h1>
			<p className='mt-2 text-gray-500'>Керування даними та швидкі дії.</p>

			<section className='mt-8 space-y-4' aria-labelledby='admin-data-heading'>
				<h2 id='admin-data-heading' className='text-sm font-medium text-gray-700'>
					Дані та інтеграції
				</h2>
				<NovaPostSyncSection />
			</section>
		</div>
	)
}

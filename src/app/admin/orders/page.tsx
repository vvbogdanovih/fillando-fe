import { Suspense } from 'react'
import { Orders } from './Orders'

// `Orders` reads its page and filters from the URL (useSearchParams), which needs a boundary;
// the fallback is the same skeleton the list shows while its first query is in flight.
export default function AdminOrdersPage() {
	return (
		<Suspense
			fallback={
				<div className='space-y-4 p-6'>
					{Array.from({ length: 5 }).map((_, index) => (
						<div key={index} className='h-16 animate-pulse rounded-md bg-gray-100' />
					))}
				</div>
			}
		>
			<Orders />
		</Suspense>
	)
}

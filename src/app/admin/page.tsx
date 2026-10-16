import { Suspense } from 'react'
import { Dashboard } from './Dashboard'
import { DashboardSkeleton } from './analytics/DashboardSkeleton'

// The dashboard reads its period from the URL (useSearchParams), which needs a boundary; the
// fallback is the same skeleton the analytics shows while its first query is in flight.
export default function AdminPage() {
	return (
		<Suspense
			fallback={
				<div className='p-6'>
					<DashboardSkeleton />
				</div>
			}
		>
			<Dashboard />
		</Suspense>
	)
}

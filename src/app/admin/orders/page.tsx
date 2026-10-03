import { Suspense } from 'react'
import { Orders } from './Orders'

export default function AdminOrdersPage() {
	// `Orders` reads its page and filters from `useSearchParams`, which needs a Suspense
	// boundary or the build bails the whole route out of prerendering.
	return (
		<Suspense>
			<Orders />
		</Suspense>
	)
}

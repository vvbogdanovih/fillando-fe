'use client'

import { useQuery } from '@tanstack/react-query'
import { getCatalogProducts } from '@/app/(root)/[category]/catalog.api'

/**
 * How many products a set of pinned filters currently matches, asked the way the storefront
 * would ask it — the same catalogue endpoint with the same parameters — so the number the
 * editor sees is the number the page will show.
 *
 * Shared by the filter picker and the form's publish guard rather than queried twice: both hit
 * the same query key, so React Query serves one request to both.
 */
export const useLandingMatchCount = (categoryId: string, filters: Record<string, string[]>) => {
	const activeFilters = Object.fromEntries(
		Object.entries(filters)
			.filter(([, values]) => values.length > 0)
			.map(([key, values]) => [key, values.join(',')])
	)

	const { data, isFetching, isSuccess } = useQuery({
		queryKey: ['landing-match-count', categoryId, activeFilters],
		queryFn: () =>
			getCatalogProducts({ category_id: categoryId, limit: '1', ...activeFilters }),
		enabled: !!categoryId
	})

	return {
		total: data?.pagination.total ?? 0,
		isCounting: isFetching,
		// Nothing may be concluded from `total` until this is true: an unanswered query also
		// reads as zero, and blocking a save on that would lock the form on a slow network.
		isKnown: isSuccess
	}
}

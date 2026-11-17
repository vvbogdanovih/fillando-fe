import { useQueries, useQuery, type QueryClient } from '@tanstack/react-query'
import { categoriesApi } from './categories.api'
import type { Category } from './categories.schema'

/**
 * The admin's category reads (Plan-0010 D06): the select list from `GET /categories/options`, the
 * characteristics of one category from `GET /categories/:id` — never the old full list.
 * Both live under `['categories', …]`, so one prefix invalidation refreshes them together.
 */
export const CATEGORY_OPTIONS_KEY = ['categories', 'options'] as const
export const categoryKey = (id: string) => ['categories', 'by-id', id] as const

export const useCategoryOptions = (enabled = true) =>
	useQuery({
		queryKey: CATEGORY_OPTIONS_KEY,
		queryFn: () => categoriesApi.getOptions(),
		enabled
	})

/** The category behind a selected id, with its characteristics; idle without one. */
export const useCategory = (id: string | null | undefined) =>
	useQuery({
		queryKey: categoryKey(id ?? ''),
		queryFn: () => categoriesApi.getById(id!),
		enabled: !!id
	})

/** The categories behind several ids (one read per distinct id), those loaded so far. */
export const useCategories = (ids: string[]): Category[] =>
	useQueries({
		queries: [...new Set(ids.filter(Boolean))].map(id => ({
			queryKey: categoryKey(id),
			queryFn: () => categoriesApi.getById(id)
		})),
		combine: results => results.flatMap(result => (result.data ? [result.data] : []))
	})

/** After a category write: the saved category as returned, and a fresh select list. */
export const syncCategory = (queryClient: QueryClient, saved: Category) => {
	queryClient.setQueryData(categoryKey(saved._id), saved)
	void queryClient.invalidateQueries({ queryKey: CATEGORY_OPTIONS_KEY })
}

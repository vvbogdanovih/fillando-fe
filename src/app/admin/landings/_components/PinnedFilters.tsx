'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/common/components/ui/badge'
import { categoriesApi } from '@/app/admin/categories/categories.api'
import { getCatalogProducts } from '@/app/(root)/[category]/catalog.api'
import { attributeLabel, buildAttributeLabels } from './landing-attributes'
import { useLandingMatchCount } from './useLandingMatchCount'

interface PinnedFiltersProps {
	categoryId: string
	value: Record<string, string[]>
	onChange: (filters: Record<string, string[]>) => void
}

/**
 * The filters a landing pins, as «Атрибут / Значення» pairs, plus how many products they
 * currently match.
 *
 * The counter is the point: a landing that matches nothing is an empty SEO page, the API
 * refuses to publish it, and seeing "0 товарів" while editing is the only moment that is cheap
 * to fix.
 *
 * Values come from the catalogue's own `filter_options`, so the editor can only pin
 * combinations that exist in the data — a hand-typed value that matches nothing is not offered
 * at all. The dimension is named the way the category names it, not by the derived key the
 * query happens to use.
 */
export const PinnedFilters = ({ categoryId, value, onChange }: PinnedFiltersProps) => {
	// Unfiltered, one item: all we need is `filter_options` and the category's dimensions.
	const { data: options, isLoading } = useQuery({
		queryKey: ['catalog-filter-options', categoryId],
		queryFn: () => getCatalogProducts({ category_id: categoryId, limit: '1' }),
		enabled: !!categoryId
	})

	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getAll()
	})
	const labels = buildAttributeLabels(categories)

	const { total, isCounting } = useLandingMatchCount(categoryId, value)

	const toggle = (key: string, option: string) => {
		const current = value[key] ?? []
		const next = current.includes(option)
			? current.filter(v => v !== option)
			: [...current, option]

		const updated = { ...value }
		if (next.length === 0) delete updated[key]
		else updated[key] = next
		onChange(updated)
	}

	if (!categoryId) {
		return <p className='text-sm text-gray-400'>Спершу оберіть категорію</p>
	}

	const filterOptions = options?.filter_options ?? {}
	const dimensions = Object.entries(filterOptions).filter(([, values]) => values.length > 0)

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex items-center justify-between'>
				<span className='text-sm text-gray-500'>Підпадає товарів</span>
				<Badge variant={total === 0 ? 'destructive' : 'secondary'}>
					{isCounting ? 'рахуємо…' : total}
				</Badge>
			</div>

			{isLoading ? (
				<p className='text-sm text-gray-400'>Завантаження фільтрів…</p>
			) : dimensions.length === 0 ? (
				<p className='text-sm text-gray-400'>
					У категорії немає значень атрибутів. Спершу прогоніть міграцію таксономії.
				</p>
			) : (
				<div className='flex flex-col gap-3'>
					{dimensions.map(([key, values]) => (
						<div key={key} className='flex flex-col gap-1.5'>
							<span className='text-xs font-medium text-gray-700'>
								{attributeLabel(labels, categoryId, key)}
							</span>
							<div className='flex flex-wrap gap-1.5'>
								{values.map(option => {
									const isOn = (value[key] ?? []).includes(option)
									return (
										<button
											key={option}
											type='button'
											onClick={() => toggle(key, option)}
											aria-pressed={isOn}
											className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
												isOn
													? 'border-gray-900 bg-gray-900 text-white'
													: 'border-gray-200 text-gray-600 hover:bg-gray-50'
											}`}
										>
											{option}
										</button>
									)
								})}
							</div>
						</div>
					))}
				</div>
			)}

			<p className='text-xs text-gray-400'>
				Кілька значень одного виміру працюють як «або». Нічого не обрано — лендінг бере всю
				категорію.
			</p>
		</div>
	)
}

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/common/components/ui/badge'
import { Button } from '@/common/components/ui/button'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
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
 * The filters a landing pins, one card per filter, each an «Атрибут» / «Значення» pair.
 *
 * The counter is the point: a landing that matches nothing is an empty SEO page, the API
 * refuses to publish it, and seeing "0" while editing is the only moment that is cheap to fix.
 *
 * Values come from the catalogue's own `filter_options`, so a combination that matches nothing
 * is not offered at all, and the dimension is named the way its category names it rather than
 * by the derived key the query happens to use. «Значення» stays a multi-select rather than the
 * single dropdown of the artboard because the data has multi-value filters — `reinforcement:
 * CF, GF` — that one dropdown cannot express.
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

	const filterOptions = options?.filter_options ?? {}
	const dimensions = Object.keys(filterOptions).filter(key => filterOptions[key].length > 0)

	/**
	 * A card whose attribute is chosen but whose values are still empty has nothing to store —
	 * `filters` is keyed by attribute and an empty array would mean "pins nothing". So the card
	 * lives here until it holds a value, and disappears from here once it does.
	 */
	const [draftKeys, setDraftKeys] = useState<string[]>([])
	const cards = [...Object.keys(value), ...draftKeys.filter(key => !(key in value))]

	const setValues = (key: string, values: string[]) => {
		const updated = { ...value }
		if (values.length === 0) delete updated[key]
		else updated[key] = values
		onChange(updated)
		// Keep the card on screen while it is empty, so clearing the last value does not make
		// the whole filter vanish under the editor's cursor.
		if (values.length === 0) setDraftKeys(prev => (prev.includes(key) ? prev : [...prev, key]))
	}

	const toggle = (key: string, option: string) => {
		const current = value[key] ?? []
		setValues(
			key,
			current.includes(option) ? current.filter(v => v !== option) : [...current, option]
		)
	}

	const changeAttribute = (from: string, to: string) => {
		const updated = { ...value }
		delete updated[from]
		// Values belong to the old dimension; the new one starts empty.
		onChange(updated)
		setDraftKeys(prev => [...prev.filter(key => key !== from), to])
	}

	const removeCard = (key: string) => {
		const updated = { ...value }
		delete updated[key]
		onChange(updated)
		setDraftKeys(prev => prev.filter(k => k !== key))
	}

	const addCard = () => {
		const free = dimensions.find(key => !cards.includes(key))
		if (free) setDraftKeys(prev => [...prev, free])
	}

	if (!categoryId) {
		return <p className='text-sm text-gray-400'>Спершу оберіть категорію</p>
	}

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
				<>
					{cards.length === 0 && (
						<p className='text-sm text-gray-400'>
							Жодного фільтра — лендінг візьме всю категорію.
						</p>
					)}

					{cards.map((key, index) => (
						<div
							key={key}
							className='flex flex-col gap-2 rounded-lg border border-gray-200 p-3'
						>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-gray-500'>
									Фільтр {index + 1}
								</span>
								<Button
									type='button'
									size='icon-sm'
									variant='ghost'
									title='Прибрати фільтр'
									onClick={() => removeCard(key)}
								>
									<Trash2Icon className='text-destructive size-3.5' />
								</Button>
							</div>

							<div className='flex flex-col gap-1.5'>
								<Label className='text-xs'>Атрибут</Label>
								<Select
									value={key}
									onValueChange={next => changeAttribute(key, next)}
								>
									<SelectTrigger className='bg-white text-black'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{dimensions
											.filter(
												option => option === key || !cards.includes(option)
											)
											.map(option => (
												<SelectItem key={option} value={option}>
													{attributeLabel(labels, categoryId, option)}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>

							<div className='flex flex-col gap-1.5'>
								<Label className='text-xs'>Значення</Label>
								<div className='flex flex-wrap gap-1.5'>
									{(filterOptions[key] ?? []).map(option => {
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
								{(value[key] ?? []).length === 0 && (
									<p className='text-xs text-amber-600'>
										Оберіть хоча б одне значення, інакше фільтр не збережеться.
									</p>
								)}
							</div>
						</div>
					))}

					{cards.length < dimensions.length && (
						<Button type='button' size='sm' variant='outline' onClick={addCard}>
							<PlusIcon className='size-3.5' />
							Додати фільтр
						</Button>
					)}
				</>
			)}

			<p className='text-xs text-gray-400'>
				Кілька значень одного атрибута працюють як «або». На сайті ці фільтри зняти не можна
				— покупець може лише додати свої, і тоді сторінка стає noindex.
			</p>
		</div>
	)
}

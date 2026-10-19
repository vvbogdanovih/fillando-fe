'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/common/components/ui/popover'
import { priceSheetApi } from '@/app/(root)/price-sheet/price-sheet.api'
import type { AdminVariant } from '@/app/(root)/price-sheet/price-sheet.schema'
import { formatPrice } from './orders.utils'

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 20

/** «PLA Kingroon — Чорний (Black)»: the product plus its colour, as the catalogue names a variant. */
export const variantLabel = (variant: Pick<AdminVariant, 'name' | 'color'>): string =>
	variant.color ? `${variant.name} — ${variant.color}` : variant.name

/**
 * «Додати товар» on the order edit (FRD §9.2): a search over the public price sheet — the one
 * flat, ACTIVE-only variant list with name, colour, article, today's price and stock — so the
 * admin replacing a sold-out spool picks the substitute the way the buyer would have. A variant
 * with no stock is listed but cannot be picked: the backend refuses it anyway (`OUT_OF_STOCK`).
 */
export function OrderLinePicker({
	onPick,
	disabled
}: {
	onPick: (variant: AdminVariant) => void
	disabled?: boolean
}) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
		return () => clearTimeout(timer)
	}, [search])

	const enabled = open && debouncedSearch.length >= MIN_QUERY_LENGTH
	const { data, isFetching, isError } = useQuery({
		queryKey: ['admin-order-line-search', debouncedSearch],
		queryFn: () => priceSheetApi.getAll({ q: debouncedSearch, page: 1, limit: RESULT_LIMIT }),
		enabled,
		placeholderData: keepPreviousData
	})

	const pick = (variant: AdminVariant) => {
		onPick(variant)
		setOpen(false)
		setSearch('')
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button type='button' variant='outline' disabled={disabled}>
					<PlusIcon className='size-4' />
					Додати товар
				</Button>
			</PopoverTrigger>
			<PopoverContent align='end' className='w-[min(92vw,32rem)] p-2'>
				<div className='relative'>
					<SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
					<Input
						autoFocus
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder='Назва, колір або артикул'
						aria-label='Пошук товару'
						className='pl-8'
					/>
				</div>
				<div className='mt-2 max-h-72 overflow-y-auto'>
					{!enabled ? (
						<p className='text-muted-foreground px-2 py-3 text-xs'>
							Введіть щонайменше {MIN_QUERY_LENGTH} символи.
						</p>
					) : isError ? (
						<p className='px-2 py-3 text-xs text-red-600'>
							Не вдалося знайти товари — спробуйте ще раз.
						</p>
					) : data && data.items.length === 0 && !isFetching ? (
						<p className='text-muted-foreground px-2 py-3 text-xs'>
							Нічого не знайдено.
						</p>
					) : (
						<ul
							className={isFetching ? 'opacity-60' : undefined}
							aria-busy={isFetching}
						>
							{(data?.items ?? []).map(variant => {
								const soldOut = !variant.in_stock
								const unitPrice = variant.sale_price ?? variant.price
								return (
									<li key={variant.id}>
										<button
											type='button'
											disabled={soldOut}
											onClick={() => pick(variant)}
											className='flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
										>
											<span className='min-w-0'>
												<span className='block truncate font-medium'>
													{variantLabel(variant)}
												</span>
												<span className='text-muted-foreground block text-xs'>
													Артикул: {variant.article ?? '—'} •{' '}
													{soldOut
														? 'немає в наявності'
														: `залишок: ${variant.stock}`}
												</span>
											</span>
											<span className='shrink-0 text-right tabular-nums'>
												{formatPrice(unitPrice)}
												{variant.sale_price != null && (
													<span className='text-muted-foreground block text-xs line-through'>
														{formatPrice(variant.price)}
													</span>
												)}
											</span>
										</button>
									</li>
								)
							})}
						</ul>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}

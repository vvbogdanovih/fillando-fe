'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { Check, ImageOff, Loader2, Search, ShoppingCart } from 'lucide-react'
import { Input } from '@/common/components/ui/input'
import { useCartStore } from '@/common/store/useCartStore'
import { mapCartErrorMessage } from '@/common/utils/cart-error.utils'
import { cn } from '@/common/utils/shad-cn.utils'
import { priceSheetApi } from './price-sheet.api'
import type { AdminVariant } from './price-sheet.schema'

const LIMIT = 50
const MANUFACTURERS = [
	{ name: 'Kingroon', logo: '/brands/kingroon.png' },
	{ name: 'Sunlu', logo: '/brands/sunlu.png' },
	{ name: 'Bambu Lab', logo: '/brands/bambu-lab.png' }
]

function formatDate(iso: string | null): string {
	if (!iso) return '—'
	const d = new Date(iso)
	if (isNaN(d.getTime())) return '—'
	const p = (n: number) => String(n).padStart(2, '0')
	// година день місяць рік
	return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

const TH =
	'sticky top-16 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase'

export const PriceSheet = () => {
	const [search, setSearch] = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')

	// Debounce search input.
	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
		return () => clearTimeout(t)
	}, [search])

	const {
		data,
		status,
		isError,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		refetch
	} = useInfiniteQuery({
		queryKey: ['price-sheet', debouncedSearch],
		queryFn: ({ pageParam }) =>
			priceSheetApi.getAll({ q: debouncedSearch, page: pageParam, limit: LIMIT }),
		initialPageParam: 1,
		getNextPageParam: (lastPage, allPages) => {
			const loaded = allPages.reduce((n, p) => n + p.items.length, 0)
			return loaded < lastPage.total ? allPages.length + 1 : undefined
		},
		placeholderData: keepPreviousData,
		staleTime: 60_000
	})

	const items = data?.pages.flatMap(p => p.items) ?? []
	const total = data?.pages[0]?.total ?? 0

	// Infinite scroll: load the next page when the sentinel enters the viewport.
	const sentinelRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = sentinelRef.current
		if (!el || !hasNextPage) return
		const observer = new IntersectionObserver(
			entries => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage()
				}
			},
			{ rootMargin: '600px 0px' } // prefetch a bit before reaching the end
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length])

	return (
		<div className='w-full'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
					<div>
						<h1 className='text-2xl font-semibold text-gray-900'>Прайс-лист</h1>
						<p className='mt-1 text-sm text-gray-500'>
							Швидка ревізія товарів. Сортування: спочатку ті, що в наявності.
						</p>
					</div>
					<div className='flex flex-wrap items-center gap-2'>
						{MANUFACTURERS.map(m => (
							<button
								key={m.name}
								type='button'
								title={m.name}
								onClick={() => setSearch(prev => (prev === m.name ? '' : m.name))}
								className={cn(
									'flex h-14 items-center rounded-lg border px-5 transition-colors',
									search === m.name
										? 'border-primary bg-primary/10'
										: 'border-gray-200 bg-white hover:bg-gray-50'
								)}
							>
								<BrandLogo name={m.name} logo={m.logo} />
							</button>
						))}
					</div>
				</div>
				<div className='relative w-full max-w-xs'>
					<Search className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
					<Input
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder='Пошук за назвою, артикулом…'
						className='border-gray-200 bg-white pl-9 text-gray-900'
					/>
				</div>
			</div>

			<div className='mt-6 rounded-lg border bg-white'>
				<table className='hidden w-full text-sm md:table'>
					<thead>
						<tr>
							<th className={`${TH} w-14`}>Фото</th>
							<th className={TH}>Назва</th>
							<th className={TH}>Виробник</th>
							<th className={TH}>Матеріал</th>
							<th className={TH}>Колір</th>
							<th className={TH}>Артикул</th>
							<th className={`${TH} text-right`}>Вартість</th>
							<th className={`${TH} text-right`}>Кількість</th>
							<th className={TH}>Синхронізовано</th>
							<th className={`${TH} text-right`} />
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-100'>
						{status === 'pending' ? (
							<tr>
								<td colSpan={10} className='px-3 py-12 text-center text-gray-400'>
									<Loader2 className='mx-auto h-5 w-5 animate-spin' />
								</td>
							</tr>
						) : isError ? (
							<tr>
								<td colSpan={10} className='px-3 py-12 text-center text-red-600'>
									Помилка завантаження.{' '}
									<button className='underline' onClick={() => refetch()}>
										Спробувати ще раз
									</button>
								</td>
							</tr>
						) : items.length === 0 ? (
							<tr>
								<td colSpan={10} className='px-3 py-12 text-center text-gray-400'>
									Нічого не знайдено
								</td>
							</tr>
						) : (
							items.map(item => <Row key={item.id} item={item} />)
						)}
					</tbody>
				</table>

				{/* Mobile cards */}
				<div className='md:hidden'>
					{status === 'pending' ? (
						<div className='py-12 text-center text-gray-400'>
							<Loader2 className='mx-auto h-5 w-5 animate-spin' />
						</div>
					) : isError ? (
						<div className='py-12 text-center text-red-600'>
							Помилка завантаження.{' '}
							<button className='underline' onClick={() => refetch()}>
								Спробувати ще раз
							</button>
						</div>
					) : items.length === 0 ? (
						<div className='py-12 text-center text-gray-400'>Нічого не знайдено</div>
					) : (
						<ul className='divide-y divide-gray-100'>
							{items.map(item => (
								<MobileCard key={item.id} item={item} />
							))}
						</ul>
					)}
				</div>

				{/* Infinite-scroll sentinel + loader */}
				{hasNextPage && (
					<div ref={sentinelRef} className='flex justify-center py-4 text-gray-400'>
						{isFetchingNextPage && <Loader2 className='h-4 w-4 animate-spin' />}
					</div>
				)}
			</div>

			<p className='mt-3 text-xs text-gray-500'>
				Показано {items.length} з {total}
				{isFetching && status !== 'pending' && <span className='ml-2'>оновлення…</span>}
			</p>
		</div>
	)
}

const Row = memo(function Row({ item }: { item: AdminVariant }) {
	return (
		<tr className='group hover:bg-gray-50'>
			<td className='px-3 py-1.5'>
				<Link
					href={`/products/${item.slug}`}
					target='_blank'
					rel='noopener noreferrer'
					className='relative block h-10 w-10'
				>
					{item.image ? (
						<Image
							src={item.image}
							alt={item.name}
							width={40}
							height={40}
							loading='lazy'
							unoptimized
							className='absolute top-0 left-0 h-10 w-10 origin-top-left cursor-zoom-in rounded-[2px] border border-gray-200 object-cover transition-transform duration-150 group-hover:z-30 group-hover:scale-[8] group-hover:border-gray-300 group-hover:shadow-2xl'
						/>
					) : (
						<div className='flex h-10 w-10 items-center justify-center rounded-[2px] border border-gray-200 bg-gray-50 text-gray-300'>
							<ImageOff className='h-4 w-4' />
						</div>
					)}
				</Link>
			</td>
			<td className='px-3 py-1.5'>
				<div className='flex items-center gap-2'>
					<span
						className={`inline-block h-2 w-2 shrink-0 rounded-full ${
							item.in_stock ? 'bg-green-500' : 'bg-gray-300'
						}`}
						title={item.in_stock ? `В наявності: ${item.stock}` : 'Немає в наявності'}
					/>
					<Link
						href={`/products/${item.slug}`}
						target='_blank'
						rel='noopener noreferrer'
						className='hover:text-primary font-medium text-gray-900 hover:underline'
					>
						{item.name}
					</Link>
				</div>
			</td>
			<td className='px-3 py-1.5 text-gray-700'>{item.manufacturer || '—'}</td>
			<td className='px-3 py-1.5 text-gray-700'>{item.material || '—'}</td>
			<td className='px-3 py-1.5 text-gray-700'>{item.color || '—'}</td>
			<td className='px-3 py-1.5 font-mono text-xs text-gray-700'>{item.article || '—'}</td>
			<td className='px-3 py-1.5 text-right whitespace-nowrap text-gray-900'>
				₴{item.price}
			</td>
			<td
				className={`px-3 py-1.5 text-right whitespace-nowrap ${
					item.in_stock ? 'text-gray-900' : 'text-gray-400'
				}`}
			>
				{item.stock}
			</td>
			<td className='px-3 py-1.5 text-xs whitespace-nowrap text-gray-500'>
				{formatDate(item.synced_at)}
			</td>
			<td className='px-3 py-1.5 text-right'>
				<AddToCartButton item={item} />
			</td>
		</tr>
	)
})

const MobileCard = memo(function MobileCard({ item }: { item: AdminVariant }) {
	const href = `/products/${item.slug}`
	return (
		<li className='flex gap-3 p-3'>
			<Link href={href} target='_blank' rel='noopener noreferrer' className='shrink-0'>
				{item.image ? (
					<Image
						src={item.image}
						alt={item.name}
						width={56}
						height={56}
						loading='lazy'
						unoptimized
						className='h-14 w-14 rounded-[2px] border border-gray-200 object-cover'
					/>
				) : (
					<div className='flex h-14 w-14 items-center justify-center rounded-[2px] border border-gray-200 bg-gray-50 text-gray-300'>
						<ImageOff className='h-5 w-5' />
					</div>
				)}
			</Link>
			<div className='min-w-0 flex-1'>
				<div className='flex items-start justify-between gap-2'>
					<Link
						href={href}
						target='_blank'
						rel='noopener noreferrer'
						className='hover:text-primary line-clamp-2 font-medium text-gray-900'
					>
						{item.name}
					</Link>
					<span className='shrink-0 font-medium whitespace-nowrap text-gray-900'>
						₴{item.price}
					</span>
				</div>
				<div className='mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500'>
					{[item.manufacturer, item.material, item.color].filter(Boolean).join(' · ') ||
						'—'}
				</div>
				{item.article && (
					<div className='mt-0.5 font-mono text-xs text-gray-500'>{item.article}</div>
				)}
				<div className='mt-2 flex items-center justify-between gap-2'>
					<span
						className={cn(
							'inline-flex items-center gap-1.5 text-xs',
							item.in_stock ? 'text-gray-700' : 'text-gray-400'
						)}
					>
						<span
							className={cn(
								'inline-block h-2 w-2 rounded-full',
								item.in_stock ? 'bg-green-500' : 'bg-gray-300'
							)}
						/>
						{item.in_stock ? `В наявності: ${item.stock}` : 'Немає'}
					</span>
					<AddToCartButton item={item} />
				</div>
				<div className='mt-1 text-[11px] text-gray-400'>
					Синхр.: {formatDate(item.synced_at)}
				</div>
			</div>
		</li>
	)
})

function BrandLogo({ name, logo }: { name: string; logo: string }) {
	const [errored, setErrored] = useState(false)
	if (errored) {
		return <span className='text-xs font-medium whitespace-nowrap text-gray-700'>{name}</span>
	}
	// eslint-disable-next-line @next/next/no-img-element
	return (
		<img
			src={logo}
			alt={name}
			className='h-9 w-auto max-w-[150px] object-contain'
			onError={() => setErrored(true)}
		/>
	)
}

const AddToCartButton = memo(function AddToCartButton({ item }: { item: AdminVariant }) {
	const addItem = useCartStore(s => s.addItem)
	const openCart = useCartStore(s => s.openCart)
	const isInCart = useCartStore(
		s =>
			s.items.some(i => i.variant_id === item.id) ||
			s.guestItems.some(i => i.variant_id === item.id)
	)
	const [isAdding, setIsAdding] = useState(false)

	const isOutOfStock = !item.in_stock

	const handleClick = async () => {
		if (isOutOfStock) return
		if (isInCart) {
			openCart()
			return
		}
		if (isAdding) return
		setIsAdding(true)
		try {
			await addItem(item.id, 1, {
				name: item.name,
				price: item.price,
				thumbnail: item.image,
				slug: item.slug
			})
		} catch (err) {
			toast.error(mapCartErrorMessage(err instanceof Error ? err.message : undefined))
		} finally {
			setIsAdding(false)
		}
	}

	return (
		<button
			onClick={handleClick}
			disabled={isAdding || isOutOfStock}
			className={cn(
				'inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
				isOutOfStock
					? 'bg-muted text-muted-foreground cursor-not-allowed'
					: isInCart
						? 'border-primary bg-primary/20 hover:bg-primary/30 border text-black'
						: 'bg-primary hover:bg-primary/80 text-black disabled:opacity-60'
			)}
		>
			{isAdding ? (
				<Loader2 className='h-4 w-4 animate-spin' />
			) : isOutOfStock ? (
				'Немає'
			) : isInCart ? (
				<>
					<Check className='h-4 w-4' />В кошику
				</>
			) : (
				<>
					<ShoppingCart className='h-4 w-4' />В кошик
				</>
			)}
		</button>
	)
})

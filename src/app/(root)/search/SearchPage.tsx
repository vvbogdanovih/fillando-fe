'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { searchProducts, type SearchResponse } from './search.api'
import { ProductGrid } from '@/app/(root)/[category]/components/ProductGrid'
import { Pagination } from '@/app/(root)/[category]/components/Pagination'

interface SearchPageProps {
	q: string
	initialData: SearchResponse | null
}

export const SearchPage = ({ q, initialData }: SearchPageProps) => {
	const searchParams = useSearchParams()

	const page = Number(searchParams.get('page')) || 1
	const limit = Number(searchParams.get('limit')) || 20

	const { data, isLoading } = useQuery({
		queryKey: ['search', q, page, limit],
		queryFn: () => searchProducts({ q, page, limit }),
		enabled: q.length >= 2,
		initialData: initialData ?? undefined
	})

	if (!q) {
		return (
			<div className='container mx-auto max-w-7xl px-4 py-16'>
				<div className='flex flex-col items-center justify-center gap-4 py-24'>
					<Search className='text-muted-foreground h-12 w-12' />
					<p className='text-muted-foreground text-lg'>Введіть запит для пошуку</p>
				</div>
			</div>
		)
	}

	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<div className='mb-8'>
				<h1 className='text-3xl font-bold'>Результати пошуку: &quot;{q}&quot;</h1>
				{data && (
					<p className='text-muted-foreground mt-1 text-sm'>
						{data.pagination.total > 0
							? `Знайдено ${data.pagination.total} товарів`
							: null}
					</p>
				)}
			</div>

			{data && data.pagination.total === 0 ? (
				<div className='flex flex-col items-center justify-center gap-4 py-24'>
					<Search className='text-muted-foreground h-12 w-12' />
					<p className='text-muted-foreground text-lg'>
						За запитом &quot;{q}&quot; нічого не знайдено
					</p>
				</div>
			) : (
				<>
					{data && data.pagination.totalPages > 1 && (
						<div className='mb-4'>
							<Pagination pagination={data.pagination} />
						</div>
					)}
					<ProductGrid items={data?.items ?? []} isLoading={isLoading} />
					{data && data.pagination.totalPages > 1 && (
						<div className='mt-8 flex items-center justify-between'>
							<span className='text-muted-foreground text-sm'>
								Показано{' '}
								{Math.min(
									(data.pagination.page - 1) * data.pagination.limit + 1,
									data.pagination.total
								)}
								&ndash;
								{Math.min(
									data.pagination.page * data.pagination.limit,
									data.pagination.total
								)}{' '}
								з {data.pagination.total}
							</span>
							<Pagination pagination={data.pagination} />
						</div>
					)}
				</>
			)}
		</div>
	)
}

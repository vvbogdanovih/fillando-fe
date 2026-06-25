export default function CatalogLoading() {
	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<div className='bg-muted mb-8 h-9 w-48 animate-pulse rounded' />
			<div className='flex gap-8'>
				<div className='hidden w-64 shrink-0 md:block'>
					<div className='flex flex-col gap-4'>
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className='bg-muted h-8 animate-pulse rounded' />
						))}
					</div>
				</div>
				<div className='grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
					{Array.from({ length: 12 }).map((_, i) => (
						<div key={i} className='flex flex-col gap-2'>
							<div className='bg-muted aspect-square animate-pulse rounded-xl' />
							<div className='bg-muted h-4 animate-pulse rounded' />
							<div className='bg-muted h-4 w-2/3 animate-pulse rounded' />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

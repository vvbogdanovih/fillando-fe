const CardSkeleton = () => (
	<div className='bg-card border-border/50 animate-pulse overflow-hidden rounded-xl border'>
		<div className='bg-foreground/10 aspect-square' />
		<div className='space-y-2 p-3'>
			<div className='bg-foreground/10 h-4 w-3/4 rounded' />
			<div className='bg-foreground/10 h-4 w-1/3 rounded' />
		</div>
	</div>
)

export default function CatalogLoading() {
	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<div className='mb-8 flex items-center justify-between'>
				<div className='bg-foreground/10 h-9 w-56 animate-pulse rounded' />
				<div className='bg-foreground/10 h-9 w-24 animate-pulse rounded-lg md:hidden' />
			</div>

			<div className='flex gap-8'>
				<aside className='hidden w-64 shrink-0 space-y-6 md:block'>
					{Array.from({ length: 4 }, (_, i) => (
						<div key={i} className='animate-pulse space-y-3'>
							<div className='bg-foreground/10 h-5 w-32 rounded' />
							<div className='bg-foreground/10 h-4 w-full rounded' />
							<div className='bg-foreground/10 h-4 w-5/6 rounded' />
							<div className='bg-foreground/10 h-4 w-2/3 rounded' />
						</div>
					))}
				</aside>
				<main className='min-w-0 flex-1'>
					<div className='mb-4 flex items-center justify-end'>
						<div className='bg-foreground/10 h-8 w-36 animate-pulse rounded' />
					</div>
					<div className='grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
						{Array.from({ length: 12 }, (_, i) => (
							<CardSkeleton key={i} />
						))}
					</div>
				</main>
			</div>
		</div>
	)
}

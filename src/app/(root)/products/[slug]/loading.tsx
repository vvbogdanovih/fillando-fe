export default function ProductLoading() {
	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<div className='bg-foreground/10 mb-6 h-4 w-48 animate-pulse rounded' />
			<div className='flex flex-col gap-8 lg:flex-row'>
				<div className='bg-foreground/10 aspect-square w-full animate-pulse rounded-xl lg:w-1/2' />
				<div className='flex flex-col gap-5 lg:w-1/2'>
					<div className='bg-foreground/10 h-8 w-3/4 animate-pulse rounded' />
					<div className='bg-foreground/10 h-6 w-24 animate-pulse rounded' />
					<div className='bg-foreground/10 h-10 w-32 animate-pulse rounded' />
					<div className='flex gap-3'>
						<div className='bg-foreground/10 h-9 w-28 animate-pulse rounded-lg' />
						<div className='bg-foreground/10 h-9 flex-1 animate-pulse rounded-lg' />
					</div>
				</div>
			</div>
		</div>
	)
}

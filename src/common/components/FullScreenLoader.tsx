export const FullScreenLoader = () => (
	<div className='bg-background fixed inset-0 flex items-center justify-center'>
		<div className='flex flex-col items-center gap-4'>
			<div className='border-muted border-t-primary h-10 w-10 animate-spin rounded-full border-4' />
			<p className='text-muted-foreground text-sm'>Завантаження...</p>
		</div>
	</div>
)

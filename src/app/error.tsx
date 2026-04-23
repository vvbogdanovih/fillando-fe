'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
	return (
		<div className='flex h-screen flex-col items-center justify-center gap-4'>
			<p className='text-destructive'>{error.message || 'Something went wrong'}</p>
			<button onClick={reset} className='text-primary hover:underline'>
				Try again
			</button>
		</div>
	)
}

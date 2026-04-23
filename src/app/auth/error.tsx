'use client'

import Link from 'next/link'
import { UI_URLS } from '@/common/constants'

export default function AuthError({ reset }: { error: Error; reset: () => void }) {
	return (
		<div className='flex h-screen flex-col items-center justify-center gap-4'>
			<p className='text-destructive'>Something went wrong.</p>
			<div className='flex gap-4'>
				<button onClick={reset} className='text-primary hover:underline'>
					Try again
				</button>
				<Link href={UI_URLS.AUTH.LOGIN} className='text-primary hover:underline'>
					Return to login
				</Link>
			</div>
		</div>
	)
}

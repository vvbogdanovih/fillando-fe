'use client'

import Link from 'next/link'
import { UI_URLS } from '@/common/constants'
import { Button } from '@/common/components/ui/button'

/**
 * Storefront error boundary. `serverFetch` throws on upstream failures (anything but 404) so
 * an outage is never cached by ISR as an empty page — this is what the visitor sees instead,
 * inside the normal (root) layout.
 */
export default function StorefrontError({ reset }: { error: Error; reset: () => void }) {
	return (
		<div className='flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center'>
			<p className='text-lg font-semibold'>Не вдалося завантажити сторінку</p>
			<p className='text-muted-foreground max-w-md text-sm'>
				Сервер тимчасово недоступний. Спробуйте ще раз за хвилину — товари й кошик нікуди не
				зникли.
			</p>
			<div className='flex gap-3'>
				<Button onClick={reset}>Спробувати ще раз</Button>
				<Button asChild variant='outline'>
					<Link href={UI_URLS.HOME}>На головну</Link>
				</Button>
			</div>
		</div>
	)
}

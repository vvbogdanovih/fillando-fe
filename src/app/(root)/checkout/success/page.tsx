import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CheckoutSuccessContent } from './CheckoutSuccessContent'

export const metadata: Metadata = {
	title: 'Замовлення оформлено | Fillando',
	description: 'Дякуємо за замовлення.'
}

export default function CheckoutSuccessPage() {
	return (
		<Suspense
			fallback={
				<div className='text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm'>
					Завантаження…
				</div>
			}
		>
			<CheckoutSuccessContent />
		</Suspense>
	)
}

import type { Metadata } from 'next'
import { NO_INDEX } from '@/common/constants/seo.constants'
import { Suspense } from 'react'
import { CheckoutSuccessContent } from './CheckoutSuccessContent'

// Neutral on purpose: the same route renders «Оплата не пройшла» and «Замовлення скасовано»,
// so a static «Замовлення оформлено» contradicted the screen. `CheckoutSuccessContent`
// sharpens `document.title` once it knows the state.
export const metadata: Metadata = {
	...NO_INDEX,
	title: 'Статус замовлення | Fillando',
	description: 'Стан вашого замовлення та його оплати.'
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

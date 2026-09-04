import type { Metadata } from 'next'
import { NO_INDEX } from '@/common/constants/seo.constants'
import { CheckoutPage } from './CheckoutPage'

export const metadata: Metadata = {
	...NO_INDEX,
	title: 'Оформлення замовлення | Fillando',
	description: 'Оформіть замовлення: доставка, оплата та підсумок кошика.'
}

export default function CheckoutRoutePage() {
	return <CheckoutPage />
}

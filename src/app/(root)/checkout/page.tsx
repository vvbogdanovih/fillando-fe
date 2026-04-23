import type { Metadata } from 'next'
import { CheckoutPage } from './CheckoutPage'

export const metadata: Metadata = {
	title: 'Оформлення замовлення | Fillando',
	description: 'Оформіть замовлення: доставка, оплата та підсумок кошика.'
}

export default function CheckoutRoutePage() {
	return <CheckoutPage />
}

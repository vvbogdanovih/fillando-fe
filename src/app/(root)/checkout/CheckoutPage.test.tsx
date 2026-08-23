import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutPage } from './CheckoutPage'

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))

vi.mock('next/navigation', () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn() })
}))

vi.mock('@/common/store/useAuthStore', () => ({
	useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: null })
}))

vi.mock('@/common/store/useCartStore', () => ({
	useCartStore: (selector: (state: unknown) => unknown) =>
		selector({
			items: [],
			guestItems: [
				{
					variant_id: 'variant-1',
					quantity: 1,
					_meta: { name: 'PLA 1.75 чорний', price: 700, thumbnail: null }
				}
			],
			isLoading: false,
			clearAfterOrder: vi.fn(),
			updateQuantity: vi.fn(),
			setGuestItemQuantity: vi.fn()
		})
}))

vi.mock('./checkout.api', () => ({
	createOrder: vi.fn(),
	initLiqpayCheckout: vi.fn(),
	fetchActivePaymentProvider: vi.fn().mockResolvedValue(null),
	fetchNovaPostCities: vi.fn().mockResolvedValue([]),
	fetchNovaPostWarehouses: vi.fn().mockResolvedValue([]),
	validateCouponCode: vi.fn()
}))

const renderCheckout = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CheckoutPage />
		</QueryClientProvider>
	)
}

const codRadio = () => screen.getByRole('radio', { name: /Накладний платіж/ })
const deliveryRadio = (name: RegExp) => screen.getByRole('radio', { name })

describe('CheckoutPage — накладний платіж', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
	afterEach(cleanup)

	it('asks for confirmation before selecting COD and keeps it after agreeing', async () => {
		renderCheckout()

		fireEvent.click(codRadio())

		expect(await screen.findByRole('dialog')).toHaveTextContent('щонайменше 200 ₴')

		fireEvent.click(screen.getByRole('button', { name: 'Погоджуюсь' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(codRadio()).toBeChecked()
	})

	it('restores the previous payment method when the conditions are declined', async () => {
		renderCheckout()

		const ibanRadio = screen.getByRole('radio', { name: /Оплата на рахунок/ })
		expect(ibanRadio).toBeChecked()

		fireEvent.click(codRadio())
		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => expect(codRadio()).not.toBeChecked())
		expect(ibanRadio).toBeChecked()
	})

	it('keeps COD selected when switching between the two Nova Post deliveries', async () => {
		renderCheckout()

		fireEvent.click(codRadio())
		fireEvent.click(await screen.findByRole('button', { name: 'Погоджуюсь' }))
		await waitFor(() => expect(codRadio()).toBeChecked())

		fireEvent.click(deliveryRadio(/Кур'єр Нова Пошта/))

		await waitFor(() => expect(deliveryRadio(/Кур'єр Нова Пошта/)).toBeChecked())
		expect(codRadio()).toBeChecked()
	})

	it('disables COD and falls back to IBAN on self-pickup', async () => {
		renderCheckout()

		fireEvent.click(codRadio())
		fireEvent.click(await screen.findByRole('button', { name: 'Погоджуюсь' }))
		await waitFor(() => expect(codRadio()).toBeChecked())

		fireEvent.click(deliveryRadio(/Самовивіз/))

		await waitFor(() => expect(codRadio()).toBeDisabled())
		expect(codRadio()).not.toBeChecked()
		expect(screen.getByRole('radio', { name: /Оплата на рахунок/ })).toBeChecked()
	})
})

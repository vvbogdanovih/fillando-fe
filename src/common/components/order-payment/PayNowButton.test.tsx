import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startLiqpayCheckout } from '@/app/(root)/checkout/liqpay.utils'
import { PayNowButton } from './PayNowButton'

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/app/(root)/checkout/liqpay.utils', () => ({ startLiqpayCheckout: vi.fn() }))

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

const renderButton = (retryAfterSeconds: number | null | undefined, onError = vi.fn()) =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<PayNowButton
				orderNumber='FO-0000123'
				retryAfterSeconds={retryAfterSeconds}
				onError={onError}
			/>
		</QueryClientProvider>
	)

describe('PayNowButton', () => {
	it('starts the LiqPay checkout for the order when no session is pending', async () => {
		vi.mocked(startLiqpayCheckout).mockResolvedValue(undefined)
		renderButton(null)

		fireEvent.click(screen.getByRole('button', { name: 'Оплатити карткою' }))

		await waitFor(() => expect(startLiqpayCheckout).toHaveBeenCalledWith('FO-0000123'))
	})

	it('waits out the cooldown instead of offering a click that would fail', () => {
		renderButton(600)

		const button = screen.getByRole('button', { name: 'Оплатити карткою можна через 10 хв' })
		expect(button).toBeDisabled()
	})

	it('treats an unknown cooldown (older backend) as "let the server decide"', () => {
		renderButton(undefined)
		expect(screen.getByRole('button', { name: 'Оплатити карткою' })).toBeEnabled()
	})

	it('translates a 409 LIQPAY_SESSION_ACTIVE into the two ways out, with the minutes left', async () => {
		vi.mocked(startLiqpayCheckout).mockRejectedValue(
			Object.assign(new Error('Conflict'), {
				status: 409,
				details: { code: 'LIQPAY_SESSION_ACTIVE', retry_after_seconds: 130 }
			})
		)
		const onError = vi.fn()
		renderButton(0, onError)

		fireEvent.click(screen.getByRole('button', { name: 'Оплатити карткою' }))

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'Ви вже відкривали сторінку оплати. Якщо платіж не завершено, спробуйте знову через 3 хв або оберіть інший спосіб оплати.'
			)
		)
		expect(onError).toHaveBeenCalledTimes(1)
	})

	it('relays any other failure as the server said it', async () => {
		vi.mocked(startLiqpayCheckout).mockRejectedValue(
			Object.assign(new Error('Замовлення вже оплачено'), { status: 400 })
		)
		renderButton(0)

		fireEvent.click(screen.getByRole('button', { name: 'Оплатити карткою' }))

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Замовлення вже оплачено'))
	})
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangePaymentMethodDialog } from './ChangePaymentMethodDialog'

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/common/hooks/useLenisModalLock', () => ({ useLenisModalLock: () => undefined }))

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

const renderDialog = (onSubmit: (method: string) => Promise<unknown>, onChanged = vi.fn()) => {
	const onOpenChange = vi.fn()
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ChangePaymentMethodDialog
				open
				onOpenChange={onOpenChange}
				orderNumber='FO-0000123'
				currentMethod='LIQPAY'
				deliveryMethod='NOVA_POST'
				onSubmit={onSubmit}
				onChanged={onChanged}
			/>
		</QueryClientProvider>
	)
	return { onOpenChange, onChanged }
}

const submit = () => screen.getByRole('button', { name: 'Змінити спосіб оплати' })

describe('ChangePaymentMethodDialog', () => {
	it('keeps the submit disabled until a method is picked, then hands it to the caller', async () => {
		const onSubmit = vi.fn().mockResolvedValue({})
		const { onOpenChange, onChanged } = renderDialog(onSubmit)

		expect(submit()).toBeDisabled()
		fireEvent.click(screen.getByLabelText(/Накладний платіж/))
		fireEvent.click(submit())

		await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('COD'))
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
		expect(onChanged).toHaveBeenCalledTimes(1)
		expect(toast.success).toHaveBeenCalledWith('Спосіб оплати змінено')
	})

	it('explains a locked order in Ukrainian and stays open', async () => {
		const locked = Object.assign(new Error('Conflict'), {
			status: 409,
			details: { code: 'PAYMENT_METHOD_LOCKED' }
		})
		const { onOpenChange } = renderDialog(vi.fn().mockRejectedValue(locked))

		fireEvent.click(screen.getByLabelText(/Переказ за IBAN/))
		fireEvent.click(submit())

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'Спосіб оплати цього замовлення вже не можна змінити. Оновіть сторінку, щоб побачити поточний стан.'
			)
		)
		expect(onOpenChange).not.toHaveBeenCalledWith(false)
	})

	it('relays the server message for other failures', async () => {
		const bad = Object.assign(
			new Error('Спосіб оплати «Готівка» доступний лише з доставкою: Самовивіз'),
			{ status: 400, details: { message: 'x' } }
		)
		renderDialog(vi.fn().mockRejectedValue(bad))

		fireEvent.click(screen.getByLabelText(/Переказ за IBAN/))
		fireEvent.click(submit())

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'Спосіб оплати «Готівка» доступний лише з доставкою: Самовивіз'
			)
		)
	})
})

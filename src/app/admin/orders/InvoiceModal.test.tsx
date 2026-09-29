import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvoiceModal } from './InvoiceModal'
import { ordersApi } from './orders.api'

vi.mock('./orders.api', () => ({ ordersApi: { downloadInvoice: vi.fn() } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const downloadInvoice = vi.mocked(ordersApi.downloadInvoice)

const open = () => {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<InvoiceModal orderId='order-id' orderNumber='FL-260901' />
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: /Завантажити інвойс/ }))
}

describe('InvoiceModal — who the invoice is for', () => {
	beforeEach(() => {
		downloadInvoice.mockReset()
		downloadInvoice.mockResolvedValue(undefined)
	})
	afterEach(cleanup)

	it('defaults to the customer copy, the one safe to hand to a buyer', async () => {
		open()
		expect(screen.getByRole('radio', { name: 'Для клієнта' })).toHaveAttribute(
			'aria-checked',
			'true'
		)
		fireEvent.click(screen.getByRole('button', { name: 'Згенерувати' }))
		await waitFor(() =>
			expect(downloadInvoice).toHaveBeenCalledWith('order-id', 'FL-260901', '', 'customer')
		)
	})

	it('sends the internal copy only when it is picked', async () => {
		open()
		fireEvent.click(screen.getByRole('radio', { name: 'Внутрішній' }))
		expect(screen.getByText(/не пересилати клієнту/)).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Згенерувати' }))
		await waitFor(() =>
			expect(downloadInvoice).toHaveBeenCalledWith('order-id', 'FL-260901', '', 'internal')
		)
	})
})

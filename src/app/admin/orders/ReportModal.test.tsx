import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportModal, reportStatusFilter } from './ReportModal'
import { ordersApi } from './orders.api'
import { orderStatusValues, paymentStatusValues } from './orders.schema'

vi.mock('./orders.api', () => ({ ordersApi: { downloadReport: vi.fn() } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const downloadReport = vi.mocked(ordersApi.downloadReport)

const openModal = () => {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ReportModal />
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Звіт' }))
	fireEvent.change(screen.getByLabelText('Дата від'), { target: { value: '2026-09-01' } })
	fireEvent.change(screen.getByLabelText('Дата до'), { target: { value: '2026-09-30' } })
}

const download = () => screen.getByRole('button', { name: 'Завантажити' })
const tick = (label: string) => fireEvent.click(screen.getByLabelText(label))
const selectAll = () => screen.getAllByLabelText('Обрати все')

describe('reportStatusFilter', () => {
	it('drops the filter when every value is ticked', () => {
		expect(reportStatusFilter([...paymentStatusValues], paymentStatusValues)).toBeUndefined()
	})

	it('keeps the dictionary order, not the click order', () => {
		expect(reportStatusFilter(['COMPLETED', 'NEW'], orderStatusValues)).toEqual([
			'NEW',
			'COMPLETED'
		])
	})
})

describe('ReportModal', () => {
	beforeEach(() => downloadReport.mockReset().mockResolvedValue(undefined))
	afterEach(cleanup)

	it('starts from completed and paid orders', async () => {
		openModal()
		expect(screen.getByLabelText('Виконано')).toHaveAttribute('data-state', 'checked')
		expect(screen.getByLabelText('Нове')).toHaveAttribute('data-state', 'unchecked')
		expect(screen.getByLabelText('Оплачено')).toHaveAttribute('data-state', 'checked')

		fireEvent.click(download())
		await waitFor(() =>
			expect(downloadReport).toHaveBeenCalledWith({
				date_from: '2026-09-01',
				date_to: '2026-09-30',
				order_status: ['COMPLETED'],
				payment_status: ['PAID']
			})
		)
	})

	it('sends every ticked status and omits a dimension once «Обрати все» is on', async () => {
		openModal()
		tick('Доставлено')
		fireEvent.click(selectAll()[1])

		fireEvent.click(download())
		await waitFor(() =>
			expect(downloadReport).toHaveBeenCalledWith({
				date_from: '2026-09-01',
				date_to: '2026-09-30',
				order_status: ['DELIVERED', 'COMPLETED']
			})
		)
	})

	it('«Обрати все» clears the group when everything was ticked, and blocks the download', () => {
		openModal()
		const [orderAll] = selectAll()
		fireEvent.click(orderAll)
		expect(
			screen.getByLabelText('Скасовано', { selector: '#report-order-status-CANCELLED' })
		).toHaveAttribute('data-state', 'checked')

		fireEvent.click(orderAll)
		expect(screen.getByLabelText('Виконано')).toHaveAttribute('data-state', 'unchecked')
		expect(screen.getByText('Оберіть хоча б один статус')).toBeInTheDocument()
		expect(download()).toBeDisabled()
	})

	it('resets to the defaults when closed', () => {
		openModal()
		tick('Виконано')
		tick('Нове')
		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

		fireEvent.click(screen.getByRole('button', { name: 'Звіт' }))
		expect(screen.getByLabelText('Виконано')).toHaveAttribute('data-state', 'checked')
		expect(screen.getByLabelText('Нове')).toHaveAttribute('data-state', 'unchecked')
	})
})

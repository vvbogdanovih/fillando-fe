import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Orders } from './Orders'
import { ordersApi } from './orders.api'

// Not `Orders.test.tsx`: on a case-insensitive file system that is the same file as the
// existing `orders.test.tsx` (utils and components), and writing it would overwrite them.

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	usePathname: () => '/admin/orders',
	useSearchParams: () => new URLSearchParams()
}))

vi.mock('./orders.api', () => ({
	ordersApi: { getAll: vi.fn() }
}))

// The report dialog pulls in its own queries; the list under test does not need it.
vi.mock('./ReportModal', () => ({ ReportModal: () => null }))

const row = (overrides: Record<string, unknown>) => ({
	id: 'o1',
	order_number: 'FO-0000001',
	created_at: '2026-10-01T10:00:00.000Z',
	items: [],
	subtotal_price: 500,
	total_price: 500,
	applied_discount: null,
	manual_discount: null,
	customer: { name: 'Іван', phone: '+380000000000', email: 'ivan@example.com' },
	delivery_method: 'NOVA_POST',
	delivery_address: null,
	payment_method: 'IBAN',
	payment_status: 'PENDING',
	order_status: 'NEW',
	comment: null,
	nova_post_ttn: null,
	status_history: [],
	allowed_status_transitions: [],
	...overrides
})

const renderOrders = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<Orders />
		</QueryClientProvider>
	)
}

beforeEach(() => {
	vi.resetAllMocks()
})

afterEach(cleanup)

describe('Orders list — ТТН column', () => {
	it('shows the TTN of a shipped order and a dash where there is none', async () => {
		vi.mocked(ordersApi.getAll).mockResolvedValue({
			items: [
				row({ id: 'o1', order_number: 'FO-0000001', nova_post_ttn: '20450000000001' }),
				row({ id: 'o2', order_number: 'FO-0000002', nova_post_ttn: null })
			],
			total: 2,
			page: 1,
			limit: 20
		} as never)

		renderOrders()

		expect(await screen.findByText('20450000000001')).toBeInTheDocument()
		expect(screen.getByRole('columnheader', { name: 'ТТН' })).toBeInTheDocument()
		const second = screen.getByText('#FO-0000002').closest('tr')
		expect(second).not.toBeNull()
		expect(second).toHaveTextContent('—')
	})

	it('marks a pickup order with the warehouse icon instead of a dash', async () => {
		vi.mocked(ordersApi.getAll).mockResolvedValue({
			items: [
				row({
					id: 'o3',
					order_number: 'FO-0000003',
					delivery_method: 'PICKUP',
					nova_post_ttn: null
				})
			],
			total: 1,
			page: 1,
			limit: 20
		} as never)

		renderOrders()

		const pickup = (await screen.findByText('#FO-0000003')).closest('tr') as HTMLElement
		const icon = within(pickup).getByTitle('Самовивіз')
		expect(icon.querySelector('svg')).not.toBeNull()
		// The cell itself, not the row: the empty «Товар» cell shows its own dash.
		expect(icon.closest('td')).not.toHaveTextContent('—')
	})
})

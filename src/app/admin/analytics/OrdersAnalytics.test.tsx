import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatUah } from '@/common/utils/price.utils'
import type { OrderStats, OrderStatsTotals } from './analytics.schema'
import { OrdersAnalytics } from './OrdersAnalytics'

afterEach(cleanup)

/*
 * The page reads «today» from the Kyiv clock, so the clock is frozen at 12:00 UTC on Friday
 * 16 October 2026 — the same day in every zone, which keeps the preset arithmetic exact.
 */
const TODAY = '2026-10-16'

const replace = vi.fn()
let currentSearch = ''
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace }),
	usePathname: () => '/admin',
	useSearchParams: () => new URLSearchParams(currentSearch)
}))

const getOrderStats = vi.fn()
vi.mock('./analytics.api', () => ({
	analyticsApi: { getOrderStats: (params: unknown) => getOrderStats(params) }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

/*
 * jsdom has no layout, so `ResponsiveContainer` measures 0 × 0 and renders nothing — not even
 * the legend. The charts themselves take explicit sizes, so the container is swapped for one
 * that hands them a fixed width; what is asserted below is text (legend, tables), never geometry.
 */
vi.mock('recharts', async importOriginal => {
	const actual = await importOriginal<typeof import('recharts')>()
	const { cloneElement, isValidElement } = await import('react')
	return {
		...actual,
		ResponsiveContainer: ({
			children,
			height
		}: {
			children: React.ReactNode
			height: number
		}) =>
			isValidElement<{ width?: number; height?: number }>(children)
				? cloneElement(children, { width: 640, height })
				: null
	}
})

const totals = (over: Partial<OrderStatsTotals> = {}): OrderStatsTotals => ({
	orders: 120,
	cancelled: 6,
	paid: 90,
	revenue: 183_400,
	avg_order_value: 1609,
	units: 240,
	...over
})

const weekday = (weekday: number, avg_orders: number, avg_revenue: number) => ({
	weekday,
	days_in_range: 4,
	orders: avg_orders * 4,
	revenue: avg_revenue * 4,
	avg_orders,
	avg_revenue
})

const product = (
	index: number,
	over: Partial<OrderStats['top_products_by_revenue'][number]> = {}
) => ({
	variant_id: `v${index}`,
	product_id: `p${index}`,
	sku: `FL-00${index}`,
	name: `Товар ${index}`,
	quantity: 20 - index,
	orders: 10 - index,
	revenue: 10_000 - index * 500,
	avg_price: 500,
	...over
})

const stats = (over: Partial<OrderStats> = {}): OrderStats => ({
	period: { date_from: '2026-09-17', date_to: '2026-10-16', days: 30 },
	previous_period: { date_from: '2026-08-18', date_to: '2026-09-16', days: 30 },
	generated_at: '2026-10-16T12:00:00.000Z',
	totals: totals(),
	previous_period_totals: totals({
		orders: 100,
		cancelled: 4,
		paid: 60,
		revenue: 150_000,
		avg_order_value: 1500
	}),
	by_day: Array.from({ length: 30 }, (_, index) => {
		const day = new Date(Date.UTC(2026, 8, 17 + index)).toISOString().slice(0, 10)
		const weekdayIndex = new Date(day).getUTCDay()
		return {
			day,
			weekday: weekdayIndex === 0 ? 7 : weekdayIndex,
			orders: 4,
			cancelled: index % 7 === 0 ? 1 : 0,
			paid: 3,
			revenue: 6000,
			units: 8
		}
	}),
	by_weekday: [
		weekday(1, 4.3, 9120),
		weekday(2, 3, 5000),
		weekday(3, 3, 5000),
		weekday(4, 3, 5000),
		weekday(5, 3, 5000),
		weekday(6, 2, 4000),
		weekday(7, 1.1, 2300)
	],
	by_hour: [],
	heatmap: [{ weekday: 1, hour: 9, orders: 3 }],
	by_payment_method: [
		{ key: 'LIQPAY', orders: 90, revenue: 140_000 },
		{ key: 'COD', orders: 30, revenue: 43_400 },
		{ key: 'APPLE_PAY', orders: 0, revenue: 0 }
	],
	by_delivery_method: [{ key: 'NOVA_POST', orders: 120, revenue: 183_400 }],
	by_order_status: [
		{ key: 'COMPLETED', orders: 114, revenue: 183_400 },
		{ key: 'CANCELLED', orders: 6, revenue: 0 }
	],
	by_payment_status: [
		{ key: 'PAID', orders: 90, revenue: 150_000 },
		{ key: 'PENDING', orders: 30, revenue: 33_400 }
	],
	top_products_by_revenue: Array.from({ length: 10 }, (_, index) =>
		product(
			index,
			index === 9 ? { product_id: null, variant_id: null, name: 'Без картки' } : {}
		)
	),
	top_products_by_quantity: Array.from({ length: 10 }, (_, index) => product(9 - index)),
	...over
})

/** RTL collapses the node's whitespace but not the expectation's — `formatUah` prints NBSPs. */
const norm = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()
const leafWithText = (expected: string) => (_: string, node: Element | null) =>
	node !== null && node.children.length === 0 && norm(node.textContent) === norm(expected)
/** The figure printed in the KPI tile with this label. */
const kpiValue = (label: string) =>
	norm(within(screen.getByTestId('kpi-row')).getByText(label).previousElementSibling?.textContent)
const legendText = () => norm(document.querySelector('.recharts-legend-wrapper')?.textContent)

const renderPage = () =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<OrdersAnalytics />
		</QueryClientProvider>
	)

beforeEach(() => {
	vi.clearAllMocks()
	vi.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`), shouldAdvanceTime: true })
	currentSearch = ''
	getOrderStats.mockResolvedValue(stats())
})

afterEach(() => {
	vi.useRealTimers()
})

describe('OrdersAnalytics — the figures', () => {
	it('asks for the default 30-day period and shows the five KPIs with their deltas', async () => {
		renderPage()

		await screen.findByText('Частка оплачених')
		expect(getOrderStats).toHaveBeenCalledWith({ date_from: '2026-09-17', date_to: TODAY })

		expect(kpiValue('Замовлень')).toBe('120')
		expect(kpiValue('Виручка')).toBe(norm(formatUah(183_400)))
		expect(kpiValue('Середній чек')).toBe(norm(formatUah(1609)))
		expect(kpiValue('Частка оплачених')).toBe('75 %')
		expect(kpiValue('Скасовано')).toBe('6')

		const deltas = screen.getAllByLabelText('Зміна проти попереднього періоду')
		expect(deltas.map(node => node.textContent)).toEqual([
			expect.stringContaining('+20 %'),
			expect.stringContaining('+22,3 %'),
			expect.stringContaining('+7,3 %'),
			expect.stringContaining('+15 п.п.'),
			expect.stringContaining('+50 %')
		])
	})

	it('spells out the strongest and weakest weekday and lists the seven rows in the table', async () => {
		renderPage()

		const sentence = await screen.findByTestId('weekday-sentence')
		expect(sentence).toHaveTextContent('Найсильніший день — понеділок')
		expect(sentence).toHaveTextContent('Найслабший — неділя')

		const table = screen.getByText('Таблиця').closest('details')!
		expect(within(table).getAllByRole('row')).toHaveLength(8) // header + 7
		expect(within(table).getByText('пʼятниця')).toBeInTheDocument()
	})

	it('maps breakdown keys to labels, keeps an unknown key visible, and links the top products that still exist', async () => {
		renderPage()

		await screen.findByText('Спосіб оплати')
		expect(screen.getByText('LiqPay')).toBeInTheDocument()
		expect(screen.getByText('Накладний платіж')).toBeInTheDocument()
		expect(screen.getByText('APPLE_PAY')).toBeInTheDocument()
		expect(
			screen.getByText(leafWithText(`90 · 75 % · ${formatUah(140_000)}`))
		).toBeInTheDocument()

		expect(screen.getByRole('link', { name: 'Товар 0' })).toHaveAttribute(
			'href',
			'/admin/products/p0/edit'
		)
		expect(screen.getByText('Без картки').closest('a')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'За кількістю' }))
		const table = screen.getByText('SKU').closest('table')!
		expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Товар 9')
	})

	it('flips the daily chart between placed and paid orders', async () => {
		renderPage()

		await screen.findByText('Частка оплачених')
		expect(legendText()).toContain('Оформлені')
		expect(legendText()).toContain('Скасовані')

		fireEvent.click(screen.getByRole('switch', { name: 'Лише оплачені' }))

		await waitFor(() => expect(legendText()).toContain('Оплачені'))
		expect(legendText()).not.toContain('Оформлені')
	})
})

describe('OrdersAnalytics — the period', () => {
	it('puts a preset in the URL and takes the default one back off it', async () => {
		renderPage()
		await screen.findByText('Частка оплачених')

		fireEvent.click(screen.getByRole('button', { name: '7 днів' }))
		expect(replace).toHaveBeenLastCalledWith('/admin?from=2026-10-10&to=2026-10-16', {
			scroll: false
		})

		fireEvent.click(screen.getByRole('button', { name: '30 днів' }))
		expect(replace).toHaveBeenLastCalledWith('/admin', { scroll: false })
	})

	it('reads a custom period from the URL and marks no preset', async () => {
		currentSearch = 'from=2026-09-01&to=2026-09-30'
		renderPage()

		await screen.findByText('Частка оплачених')
		expect(getOrderStats).toHaveBeenCalledWith({
			date_from: '2026-09-01',
			date_to: '2026-09-30'
		})
		expect(screen.getByRole('button', { name: '30 днів' })).toHaveAttribute(
			'aria-pressed',
			'false'
		)
	})

	it('applies a typed range once both ends are valid, and explains a reversed one instead', async () => {
		renderPage()
		await screen.findByText('Частка оплачених')

		fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-01' } })
		fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-10-10' } })
		expect(replace).toHaveBeenLastCalledWith('/admin?from=2026-10-01&to=2026-10-10', {
			scroll: false
		})

		replace.mockClear()
		fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-12' } })
		fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-10-05' } })
		expect(screen.getByRole('alert')).toHaveTextContent('Дата «від» пізніша за «до»')
		expect(replace).not.toHaveBeenCalled()
	})
})

describe('OrdersAnalytics — states', () => {
	it('offers a retry when the request fails', async () => {
		getOrderStats.mockRejectedValueOnce(new Error('boom'))
		renderPage()

		const retry = await screen.findByRole('button', { name: 'Спробувати знову' })
		getOrderStats.mockResolvedValueOnce(stats())
		fireEvent.click(retry)

		await waitFor(() => expect(getOrderStats).toHaveBeenCalledTimes(2))
		expect(await screen.findByText('Частка оплачених')).toBeInTheDocument()
	})

	it('says so when both periods are empty, and keeps the picker', async () => {
		getOrderStats.mockResolvedValue(
			stats({
				totals: totals({
					orders: 0,
					cancelled: 0,
					paid: 0,
					revenue: 0,
					avg_order_value: 0,
					units: 0
				}),
				previous_period_totals: totals({
					orders: 0,
					cancelled: 0,
					paid: 0,
					revenue: 0,
					avg_order_value: 0,
					units: 0
				})
			})
		)
		renderPage()

		expect(await screen.findByText('За обраний період замовлень немає.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '7 днів' })).toBeInTheDocument()
		expect(screen.queryByText('Частка оплачених')).not.toBeInTheDocument()
	})
})

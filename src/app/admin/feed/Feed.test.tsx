import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import toast from 'react-hot-toast'
import { Feed } from './Feed'
import type { FeedStatus, FeedSummary } from './feed.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

const getStatus = vi.fn()
const regenerate = vi.fn()
vi.mock('./feed.api', () => ({
	feedApi: {
		getStatus: () => getStatus(),
		regenerate: () => regenerate(),
		publicXmlUrl: () => 'http://api.test/feeds/google-shopping.xml',
		absoluteUrl: (path: string) => `http://api.test${path}`
	}
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

/**
 * The mock is built relative to «now» on purpose: whether the banner reads «актуальний» or
 * «застарілий» is a function of the clock, so a hard-coded date would make the suite go stale.
 */
const summary = (over: Partial<FeedSummary> = {}): FeedSummary => ({
	ok: true,
	failure_reason: null,
	error: null,
	generated_at: new Date().toISOString(),
	duration_ms: 812,
	item_count: 142,
	in_stock: 128,
	out_of_stock: 14,
	typed_by_landing: 140,
	excluded: [
		{ sku: 'FL-000301', name: 'Kingroon PLA — Без фото', reason: 'no_images' },
		{ sku: 'FL-000302', name: 'Sunlu PETG — Без бренду', reason: 'missing_brand' }
	],
	// Four kinds behind 3 + 2 + 1 + 1 = 7 affected entities — the KPI must show 4, not 7.
	warnings: [
		{
			code: 'no_weight',
			count: 3,
			unit: 'item',
			item_count: 3,
			skus: ['FL-000001', 'FL-000002', 'FL-000003']
		},
		{ code: 'no_description', count: 2, unit: 'item', item_count: 2, skus: ['FL-000005'] },
		{
			code: 'missing_required_attribute',
			count: 1,
			unit: 'item',
			item_count: 1,
			skus: ['FL-000006'],
			detail: { diameter: 1 },
			attributes: [{ key: 'diameter', label: 'Діаметр', count: 1 }]
		},
		{
			code: 'no_google_product_category',
			count: 1,
			unit: 'category',
			item_count: 40,
			skus: ['FL-000004']
		}
	],
	warning_kinds: 4,
	warned_items: 6,
	...over
})

const feedStatus = (over: Partial<FeedStatus> = {}): FeedStatus => ({
	xml_ready: true,
	generating: false,
	scheduled: true,
	feed_path: '/feeds/google-shopping.xml',
	last_error: null,
	summary: summary(),
	...over
})

const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString()

const renderScreen = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<Feed />
		</QueryClientProvider>
	)
}

describe('Feed screen', () => {
	it('shows the summary: KPIs, excluded rows with human reasons, warnings', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		renderScreen()

		expect(await screen.findByText(/Фід актуальний/)).toBeInTheDocument()
		expect(screen.getByText('142')).toBeInTheDocument()
		expect(screen.getByText('в наявності · 14 немає')).toBeInTheDocument()
		expect(screen.getByText('FL-000301')).toBeInTheDocument()
		expect(screen.getByText('Немає жодного фото')).toBeInTheDocument()
		expect(screen.getByText(/Google вимагає бренд/)).toBeInTheDocument()
		expect(screen.getByText('Не заповнена вага')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /Відкрити XML/ })).toHaveAttribute(
			'href',
			'http://api.test/feeds/google-shopping.xml'
		)
	})

	it('counts warning kinds in the KPI, not the positions behind them', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		expect(screen.getByText('4')).toBeInTheDocument()
		// 3 + 2 + 1 + 1: the number the screen used to print under the label «попереджень».
		expect(screen.queryByText('7')).not.toBeInTheDocument()
		expect(screen.getByText('Позицій із попередженнями: 6 з 142.')).toBeInTheDocument()
	})

	it('names each warning in its own unit, with the Ukrainian plural form', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		expect(screen.getByText('3 товари')).toBeInTheDocument()
		expect(screen.queryByText('3 товарів')).not.toBeInTheDocument()
		expect(screen.getByText('2 товари')).toBeInTheDocument()
		expect(screen.getByText('1 товар')).toBeInTheDocument()
		// A category-scoped warning counts categories, however many rows sit behind it.
		expect(screen.getByText('1 категорія')).toBeInTheDocument()
		expect(screen.queryByText('1 категорій')).not.toBeInTheDocument()
	})

	it('prints the required-attribute gap by label, not by raw key', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		expect(screen.getByText(/«Діаметр»: 1/)).toBeInTheDocument()
		expect(screen.queryByText(/diameter/)).not.toBeInTheDocument()
	})

	it('explains the cold start instead of showing empty numbers', async () => {
		getStatus.mockResolvedValueOnce(feedStatus({ xml_ready: false, summary: null }))
		renderScreen()

		expect(await screen.findByText(/ще генерується після запуску/)).toBeInTheDocument()
		expect(screen.queryByText('товарів у фіді')).not.toBeInTheDocument()
	})

	it('does not offer the XML link before the first generation', async () => {
		getStatus.mockResolvedValueOnce(feedStatus({ xml_ready: false, summary: null }))
		renderScreen()

		await screen.findByText(/ще генерується після запуску/)
		expect(screen.queryByRole('link', { name: /Відкрити XML/ })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Відкрити XML/ })).toBeDisabled()
	})

	it('marks the feed stale when the scheduled run never happened', async () => {
		getStatus.mockResolvedValueOnce(
			feedStatus({ summary: summary({ generated_at: hoursAgo(3) }) })
		)
		renderScreen()

		expect(await screen.findByText(/Фід застарілий/)).toBeInTheDocument()
		expect(screen.queryByText(/Фід актуальний/)).not.toBeInTheDocument()
		expect(screen.getByText(/не спрацювала/)).toBeInTheDocument()
		// The promise of a future run is exactly what printed a past time (I-38).
		expect(screen.queryByText(/Наступна автогенерація/)).not.toBeInTheDocument()
	})

	it('keeps the fresh banner while the schedule has not come round yet', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		renderScreen()

		expect(await screen.findByText(/Фід актуальний/)).toBeInTheDocument()
		expect(screen.getByText(/Наступна автогенерація о/)).toBeInTheDocument()
		expect(screen.queryByText(/Фід застарілий/)).not.toBeInTheDocument()
	})

	it('shows the absolute feed address and copies it', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
		getStatus.mockResolvedValueOnce(feedStatus())
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		expect(screen.getByText('http://api.test/feeds/google-shopping.xml')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Скопіювати адресу фіда' }))

		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith('http://api.test/feeds/google-shopping.xml')
		)
	})

	it('regenerates on demand and shows the fresh summary', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		regenerate.mockResolvedValueOnce(summary({ item_count: 143, excluded: [] }))
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		fireEvent.click(screen.getByRole('button', { name: /Перегенерувати/ }))

		await waitFor(() => expect(regenerate).toHaveBeenCalledTimes(1))
		expect(await screen.findByText('143')).toBeInTheDocument()
		expect(screen.getByText(/Жодного виключення/)).toBeInTheDocument()
	})

	it('treats a 2xx refusal as a failure, not as a publish', async () => {
		getStatus.mockResolvedValueOnce(feedStatus())
		regenerate.mockResolvedValueOnce(
			summary({
				ok: false,
				failure_reason: 'empty_feed',
				error: 'Генерація дала 0 позицій — попередній XML залишено',
				item_count: 0
			})
		)
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		fireEvent.click(screen.getByRole('button', { name: /Перегенерувати/ }))

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'Генерація дала 0 позицій — попередній XML залишено'
			)
		)
		expect(toast.success).not.toHaveBeenCalled()
		// The XML Google fetches did not move, so its own summary must not either.
		expect(screen.getByText('142')).toBeInTheDocument()
		expect(await screen.findByText(/Останній прогін не вдався/)).toBeInTheDocument()
		expect(screen.getByText(/Google досі отримує XML/)).toBeInTheDocument()
	})

	it('re-asks the status while a generation is running', async () => {
		getStatus.mockResolvedValueOnce(feedStatus({ generating: true }))
		getStatus.mockResolvedValue(feedStatus())
		renderScreen()

		expect(await screen.findByText('Фід генерується')).toBeInTheDocument()
		expect(await screen.findByText(/Фід актуальний/, {}, { timeout: 8000 })).toBeInTheDocument()
		expect(getStatus.mock.calls.length).toBeGreaterThan(1)
	}, 12000)

	it('offers a retry when the status cannot be loaded', async () => {
		getStatus.mockRejectedValueOnce(new Error('boom'))
		renderScreen()

		expect(await screen.findByText('Помилка завантаження статусу фіда')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Перегенерувати/ })).toBeDisabled()
	})
})

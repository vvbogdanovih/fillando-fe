import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Feed } from './Feed'
import type { FeedStatus } from './feed.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

const getStatus = vi.fn()
const regenerate = vi.fn()
vi.mock('./feed.api', () => ({
	feedApi: {
		getStatus: () => getStatus(),
		regenerate: () => regenerate(),
		publicXmlUrl: () => 'http://api.test/feeds/google-shopping.xml'
	}
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const READY: FeedStatus = {
	xml_ready: true,
	generating: false,
	scheduled: true,
	feed_path: '/feeds/google-shopping.xml',
	last_error: null,
	summary: {
		generated_at: '2026-09-02T09:04:00.000Z',
		duration_ms: 812,
		item_count: 142,
		in_stock: 128,
		out_of_stock: 14,
		typed_by_landing: 140,
		excluded: [
			{ sku: 'FL-000301', name: 'Kingroon PLA — Без фото', reason: 'no_images' },
			{ sku: 'FL-000302', name: 'Sunlu PETG — Без бренду', reason: 'missing_brand' }
		],
		warnings: [
			{ code: 'no_weight', count: 3, skus: ['FL-000001', 'FL-000002', 'FL-000003'] },
			{ code: 'no_google_product_category', count: 1, skus: ['FL-000004'] }
		]
	}
}

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
		getStatus.mockResolvedValueOnce(READY)
		renderScreen()

		expect(await screen.findByText(/Фід актуальний/)).toBeInTheDocument()
		expect(screen.getByText('142')).toBeInTheDocument()
		expect(screen.getByText('в наявності · 14 немає')).toBeInTheDocument()
		expect(screen.getByText('4')).toBeInTheDocument()
		expect(screen.getByText('FL-000301')).toBeInTheDocument()
		expect(screen.getByText('Немає жодного фото')).toBeInTheDocument()
		expect(screen.getByText(/Google вимагає бренд/)).toBeInTheDocument()
		expect(screen.getByText('Не заповнена вага')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /Відкрити XML/ })).toHaveAttribute(
			'href',
			'http://api.test/feeds/google-shopping.xml'
		)
	})

	it('explains the cold start instead of showing empty numbers', async () => {
		getStatus.mockResolvedValueOnce({ ...READY, xml_ready: false, summary: null })
		renderScreen()

		expect(await screen.findByText(/ще генерується після запуску/)).toBeInTheDocument()
		expect(screen.queryByText('товарів у фіді')).not.toBeInTheDocument()
	})

	it('regenerates on demand and shows the fresh summary', async () => {
		getStatus.mockResolvedValueOnce(READY)
		regenerate.mockResolvedValueOnce({ ...READY.summary!, item_count: 143, excluded: [] })
		renderScreen()

		await screen.findByText(/Фід актуальний/)
		fireEvent.click(screen.getByRole('button', { name: /Перегенерувати/ }))

		await waitFor(() => expect(regenerate).toHaveBeenCalledTimes(1))
		expect(await screen.findByText('143')).toBeInTheDocument()
		expect(screen.getByText(/Жодного виключення/)).toBeInTheDocument()
	})

	it('offers a retry when the status cannot be loaded', async () => {
		getStatus.mockRejectedValueOnce(new Error('boom'))
		renderScreen()

		expect(await screen.findByText('Помилка завантаження статусу фіда')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Перегенерувати/ })).toBeDisabled()
	})
})

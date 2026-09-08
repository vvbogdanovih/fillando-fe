import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getVariantBySlug, type ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { ProductPage } from './ProductPage'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))
vi.mock('@/app/(root)/[category]/catalog.api', () => ({
	getVariantBySlug: vi.fn(() => new Promise(() => {}))
}))
vi.mock('@/common/lib/ga4-events', () => ({
	trackViewItem: vi.fn(),
	trackAddToCart: vi.fn()
}))
vi.mock('@/common/store/useCartStore', async () => {
	const { create } = await import('zustand')
	const useCartStore = create(() => ({
		items: [] as { variant_id: string }[],
		guestItems: [] as { variant_id: string }[],
		addItem: vi.fn().mockResolvedValue(undefined),
		openCart: vi.fn()
	}))
	return { useCartStore }
})

beforeEach(() => {
	// A request that never settles is the neutral default: every test that cares about the
	// client query says so itself.
	vi.mocked(getVariantBySlug).mockReset()
	vi.mocked(getVariantBySlug).mockImplementation(() => new Promise(() => {}))
})

const data = (
	overrides: Partial<ProductDetailData['variant']> = {},
	patch: Partial<ProductDetailData> = {}
): ProductDetailData => ({
	variant: {
		id: 'v1',
		name: 'Kingroon PLA 1,75 мм 1 кг — Чорний (Black)',
		slug: 'kingroon-pla-black',
		sku: 'FL-000001',
		price: 419,
		price_updated_at: null,
		stock: 12,
		images: ['https://cdn.example.invalid/black.jpg'],
		v_value: 'Black',
		status: 'active',
		color: { name_uk: 'Чорний', name_en: 'Black', family: 'black', hex_stops: ['#111418'] },
		weight_g: 1220,
		...overrides
	},
	product: {
		id: 'p1',
		name: 'Kingroon PLA 1,75 мм 1 кг',
		description: null,
		attributes: [
			{ k: 'vyrobnyk', l: 'Виробник', v: 'Kingroon' },
			{ k: 'polymer', l: 'Тип пластику', v: 'PLA' }
		],
		variant_type: { key: 'kolir', label: 'Колір' },
		manufacturer: 'Kingroon'
	},
	siblings: [
		{
			id: 'v1',
			name: 'Kingroon PLA 1,75 мм 1 кг — Чорний (Black)',
			slug: 'kingroon-pla-black',
			price: 419,
			price_updated_at: null,
			stock: 12,
			v_value: 'Black',
			images: [],
			color: { name_uk: 'Чорний', name_en: 'Black', family: 'black', hex_stops: ['#111418'] }
		},
		{
			id: 'v2',
			name: 'Kingroon PLA 1,75 мм 1 кг — Білий (White)',
			slug: 'kingroon-pla-white',
			price: 419,
			price_updated_at: null,
			stock: 3,
			v_value: 'White',
			images: [],
			color: { name_uk: 'Білий', name_en: 'White', family: 'white', hex_stops: ['#f7f7f5'] }
		}
	],
	category_slug: 'filament',
	category_name: 'Філамент',
	spooled_counterpart: null,
	...patch
})

const renderPage = (initialData: ProductDetailData) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const view = render(
		<QueryClientProvider client={client}>
			<ProductPage slug={initialData.variant.slug} initialData={initialData} />
		</QueryClientProvider>
	)
	return { ...view, client }
}

describe('ProductPage', () => {
	it('shows the brand chip, the weight-based delivery estimate and a live buy button', () => {
		renderPage(data())

		// The chip above the title only: the spec table no longer repeats «Виробник».
		expect(screen.getAllByText('Kingroon')).toHaveLength(1)
		expect(
			screen.getByText(/Нова Пошта — орієнтовно 93 ₴, доставка 1–3 дні/)
		).toBeInTheDocument()
		expect(screen.getByText(/Розраховано за вагою 1,22 кг/)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Додати в кошик/ })).toBeEnabled()
		// Two siblings → the colour switcher is on the page, labelled with the variant axis.
		expect(screen.getByText(/Колір/)).toBeInTheDocument()
	})

	/** The switcher hides itself below two variants; the caption is still part of the page. */
	it('names the chosen colour even when the product has a single one', () => {
		const single = data()
		renderPage(data({}, { siblings: [single.siblings[0]] }))

		expect(screen.getByText(/Колір:/)).toBeInTheDocument()
		expect(screen.getByText('Чорний (Black)')).toBeInTheDocument()
	})

	it('quotes no number when the weight is unknown', () => {
		renderPage(data({ weight_g: null }))

		expect(screen.getByText(/за тарифом перевізника/)).toBeInTheDocument()
		expect(screen.getByText(/Вага товару ще не вказана/)).toBeInTheDocument()
		expect(screen.queryByText(/орієнтовно/)).not.toBeInTheDocument()
	})

	/** A stored 0 used to fall into the cheapest tier and read «розраховано за вагою 0 кг». */
	it('treats a zero weight as no weight rather than as the lightest parcel', () => {
		renderPage(data({ weight_g: 0 }))

		expect(screen.getByText(/Вага товару ще не вказана/)).toBeInTheDocument()
		expect(screen.queryByText(/орієнтовно/)).not.toBeInTheDocument()
		expect(screen.queryByText(/за вагою 0 кг/)).not.toBeInTheDocument()
	})

	/** Over the contract table the weight IS known — saying otherwise was the lie. */
	it('says a parcel over the table is heavy, not unweighed', () => {
		renderPage(data({ weight_g: 12000 }))

		expect(screen.getByText(/за тарифом перевізника, доставка 1–3 дні/)).toBeInTheDocument()
		expect(screen.getByText(/Вага понад 10 кг/)).toBeInTheDocument()
		expect(screen.queryByText(/Вага товару ще не вказана/)).not.toBeInTheDocument()
		expect(screen.queryByText(/орієнтовно/)).not.toBeInTheDocument()
	})

	it('renders an archived variant as discontinued: no buying, no switching, a way out', () => {
		// A non-empty stock on an archived variant is the case that used to paint the badge green
		// and leave a working quantity counter beside a dead button.
		renderPage(data({ status: 'archived', stock: 5 }))

		const badge = screen.getByText('Знято з продажу')
		expect(badge.className).toContain('bg-muted')
		expect(badge.className).not.toContain('bg-green-700')
		expect(screen.queryByLabelText('Кількість')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('Збільшити кількість')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Немає в продажу/ })).toBeDisabled()
		expect(screen.getByText('Цей товар знято з продажу')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /у категорії «Філамент»/ })).toHaveAttribute(
			'href',
			'/filament'
		)
		expect(screen.queryByText(/Колір/)).not.toBeInTheDocument()
		expect(screen.queryByText(/Нова Пошта/)).not.toBeInTheDocument()
	})

	/** The server already fetched this page; refetching it on hydration buys nothing. */
	it('does not refetch the server-rendered product on hydration', async () => {
		renderPage(data())
		await act(async () => {})

		expect(getVariantBySlug).not.toHaveBeenCalled()
	})

	it('keeps the rendered page when the client request fails', async () => {
		vi.mocked(getVariantBySlug).mockRejectedValue(new Error('Request failed with status 500'))
		const { client } = renderPage(data())

		await act(async () => {
			await client.refetchQueries({ queryKey: ['product', 'kingroon-pla-black'] })
		})

		// React Query keeps `data` beside the error, so the page must keep the sale alive.
		expect(client.getQueryState(['product', 'kingroon-pla-black'])?.status).toBe('error')
		expect(
			screen.getByRole('heading', { name: 'Kingroon PLA 1,75 мм 1 кг — Чорний (Black)' })
		).toBeInTheDocument()
		expect(screen.getByText('419 ₴')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Додати в кошик/ })).toBeEnabled()
		expect(screen.queryByText('Товар не знайдено')).not.toBeInTheDocument()
	})
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'
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

const data = (overrides: Partial<ProductDetailData['variant']> = {}): ProductDetailData => ({
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
	spooled_counterpart: null
})

const renderPage = (initialData: ProductDetailData) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<ProductPage slug={initialData.variant.slug} initialData={initialData} />
		</QueryClientProvider>
	)
}

describe('ProductPage', () => {
	it('shows the brand chip, the weight-based delivery estimate and a live buy button', () => {
		renderPage(data())

		// Once as the chip above the title, once as the «Виробник» row of the spec table.
		expect(screen.getAllByText('Kingroon')).toHaveLength(2)
		expect(screen.getByText(/Нова Пошта — орієнтовно 93 ₴, 1–3 дні/)).toBeInTheDocument()
		expect(screen.getByText(/Розраховано за вагою 1,22 кг/)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Додати в кошик/ })).toBeEnabled()
		// Two siblings → the colour switcher is on the page, labelled with the variant axis.
		expect(screen.getByText(/Колір/)).toBeInTheDocument()
	})

	it('quotes no number when the weight is unknown', () => {
		renderPage(data({ weight_g: null }))

		expect(screen.getByText(/за тарифом перевізника/)).toBeInTheDocument()
		expect(screen.getByText(/Вага товару ще не вказана/)).toBeInTheDocument()
		expect(screen.queryByText(/орієнтовно/)).not.toBeInTheDocument()
	})

	it('renders an archived variant as discontinued: no buying, no switching, a way out', () => {
		renderPage(data({ status: 'archived', stock: 5 }))

		expect(screen.getAllByText('Знято з продажу').length).toBeGreaterThan(0)
		expect(screen.getByRole('button', { name: /Знято з продажу/ })).toBeDisabled()
		expect(screen.getByText('Цей товар знято з продажу')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /у категорії «Філамент»/ })).toHaveAttribute(
			'href',
			'/filament'
		)
		expect(screen.queryByText(/Колір/)).not.toBeInTheDocument()
		expect(screen.queryByText(/Нова Пошта/)).not.toBeInTheDocument()
	})
})

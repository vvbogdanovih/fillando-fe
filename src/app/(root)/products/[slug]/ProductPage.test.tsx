import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { waitFor, act, cleanup, render, screen, within } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getVariantBySlug, type ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { ProductPage } from './ProductPage'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

vi.mock('next/image', () => ({
	default: ({
		fill: _fill,
		preload: _preload,
		...props
	}: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; preload?: boolean }) => (
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
		attributes: [{ k: 'polymer', l: 'Тип пластику', v: 'PLA' }],
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
	...patch
})

const RENDERED_AT = '2026-10-04T23:59:30.000Z'

const renderPage = (
	initialData: ProductDetailData,
	categoryPath: { _id: string; name: string; slug: string }[] | null = null
) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const view = render(
		<QueryClientProvider client={client}>
			<ProductPage
				slug={initialData.variant.slug}
				initialData={initialData}
				renderedAt={RENDERED_AT}
				categoryPath={categoryPath}
			/>
		</QueryClientProvider>
	)
	return { ...view, client }
}

describe('ProductPage', () => {
	describe('category path too long to embed (Plan-0010 D06.4)', () => {
		const deep = Array.from({ length: 1500 }, (_, n) => ({
			_id: `g${n}`,
			name: `Рівень ${n}`,
			slug: `level-${n}`
		}))
		const own = { _id: 'c1', name: 'Філамент', slug: 'filament' }
		const crumbs = (container: HTMLElement) =>
			[...container.querySelectorAll('script[type="application/ld+json"]')]
				.map(node => JSON.parse(node.textContent ?? '{}'))
				.find(item => item['@type'] === 'BreadcrumbList') as {
				itemListElement: { name: string }[]
			}
		it('renders the whole path the server read, in the trail and in BreadcrumbList', () => {
			const { container } = renderPage(
				data(
					{},
					{ category_path: [own], category_path_paged: true, category_path_total: 1501 }
				),
				[...deep, own]
			)
			const list = crumbs(container)
			// Головна, Каталог, 1 500 ancestors, the category, the product.
			expect(list.itemListElement).toHaveLength(1504)
			expect(list.itemListElement[2].name).toBe('Рівень 0')
			expect(list.itemListElement[1502].name).toBe('Філамент')
		})
		it('keeps the embedded path at an ordinary depth', () => {
			const { container } = renderPage(data({}, { category_path: [deep[0], own] }))
			expect(crumbs(container).itemListElement.map(item => item.name)).toEqual([
				'Головна',
				'Каталог',
				'Рівень 0',
				'Філамент',
				'Kingroon PLA 1,75 мм 1 кг — Чорний (Black)'
			])
		})
		it('repeats the category page trail: Головна › Каталог › the path (owner, 01.11.2026)', () => {
			renderPage(data({}, { category_path: [deep[0], own] }))
			const trail = screen.getByRole('navigation', { name: 'Хлібні крихти' })
			const links = within(trail).getAllByRole('link')
			expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
				['Головна', '/'],
				['Каталог', '/catalog'],
				['Рівень 0', '/level-0'],
				['Філамент', '/filament']
			])
		})
	})

	it('shows no brand chip, the weight-based delivery estimate and a live buy button', () => {
		renderPage(data())

		// The brand reaches the page only as a row of the table the admin configures (owner,
		// 2026-11-08); `manufacturer` stays for the structured data and analytics.
		expect(screen.queryByText('Kingroon')).not.toBeInTheDocument()
		expect(
			screen.getByText(/Нова Пошта — орієнтовно 93 ₴, доставка 1–3 дні/)
		).toBeInTheDocument()
		expect(screen.getByText(/Розраховано за вагою 1,22 кг/)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Додати в кошик/ })).toBeEnabled()
		// Two siblings → the colour switcher is on the page, labelled with the variant axis.
		expect(screen.getByText(/Колір/)).toBeInTheDocument()
	})

	/**
	 * The backend orders a v2 table by the category's definitions and leaves out what is not
	 * marked «У таблиці характеристик на сторінці товару» (owner, 2026-11-05): the page prints the
	 * rows as sent — no reordering, hiding or emphasis of its own.
	 */
	it('prints the specification rows as the backend sends them', () => {
		const base = data()
		renderPage(
			data(
				{},
				{
					product: {
						...base.product,
						attributes: [
							{ k: 'spool_included', l: 'Котушка в комплекті', v: 'Ні (рефіл)' },
							{ k: 'material', l: 'Матеріал', v: 'PLA Silk' },
							{ k: 'vaha', l: 'Вага', v: 1, unit: 'кг' }
						]
					},
					attribute_notice: null
				}
			)
		)

		const rows = screen
			.getAllByRole('row')
			.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent))
		expect(rows).toEqual([
			['Котушка в комплекті', 'Ні (рефіл)'],
			['Матеріал', 'PLA Silk'],
			['Вага', '1 кг']
		])
		expect(screen.getByText('Ні (рефіл)')).not.toHaveClass('text-amber-700')
	})

	/** The switcher hides itself below two variants; the caption is still part of the page. */
	it('names the chosen colour even when the product has a single one', () => {
		const single = data()
		renderPage(data({}, { siblings: [single.siblings[0]] }))

		expect(screen.getByText(/Колір:/)).toBeInTheDocument()
		expect(screen.getByText('Чорний (Black)')).toBeInTheDocument()
	})

	describe('purchase notice (Plan-0010 F08; product data since 2026-11-05)', () => {
		const refill = {
			attributes: [
				{ k: 'polymer', l: 'Тип пластику', v: 'PLA' },
				{ k: 'spool_included', l: 'Котушка в комплекті', v: 'Ні (рефіл)' }
			]
		}

		it('takes the notice and the photo badge from the v2 product', () => {
			const base = data()
			renderPage(
				data(
					{},
					{
						product: { ...base.product, ...refill },
						attribute_notice: {
							title: 'Рефіл без котушки',
							text: 'Потрібна власна котушка.',
							badge: 'Рефіл'
						}
					}
				)
			)

			expect(screen.getByText('Рефіл')).toBeInTheDocument()
			expect(screen.getByText('Рефіл без котушки')).toBeInTheDocument()
			// No built-in filament wording on a v2 page.
			expect(screen.queryByText('Без котушки')).not.toBeInTheDocument()
			expect(screen.queryByText('Це рефіл — без котушки')).not.toBeInTheDocument()
		})

		it('shows nothing of it on a v2 page whose product has no notice', () => {
			const base = data()
			renderPage(
				data(
					{},
					{
						product: { ...base.product, ...refill },
						attribute_notice: null
					}
				)
			)

			expect(screen.queryByText('Без котушки')).not.toBeInTheDocument()
			expect(screen.queryByText('Це рефіл — без котушки')).not.toBeInTheDocument()
		})

		it('keeps the built-in refill card on a legacy page', () => {
			const base = data()
			renderPage(data({}, { product: { ...base.product, ...refill } }))

			expect(screen.getByText('Без котушки')).toBeInTheDocument()
			expect(screen.getByText('Це рефіл — без котушки')).toBeInTheDocument()
		})
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

	describe('promotions (TD-0012)', () => {
		const onSale = () =>
			data({ sale_price: 356, promo_percent: 15, promo_ends_at: '2099-11-01T12:00:00.000Z' })

		it('keeps markup and visible price together until a fresh response clears an expired promo', async () => {
			const { container, client } = renderPage(
				data({ sale_price: 356, promo_percent: 15, promo_ends_at: '2020-01-01T00:00:00Z' })
			)
			// Two colours → the page's markup is a ProductGroup whose first variant is this SKU.
			const offer = () =>
				JSON.parse(
					container.querySelector('script[type="application/ld+json"]')!.textContent!
				).hasVariant[0].offers
			expect(screen.getByText('356 ₴')).toBeInTheDocument()
			expect(offer().price).toBe(356)
			expect(offer().priceSpecification[0].price).toBe(419)

			await act(async () => {
				client.setQueryData(
					['product', data().variant.slug],
					data({
						sale_price: null,
						promo_percent: null,
						promo_ends_at: null
					})
				)
			})
			expect(screen.getByText('419 ₴')).toBeInTheDocument()
			await waitFor(() => expect(screen.queryByText('356 ₴')).not.toBeInTheDocument())
			expect(offer().price).toBe(419)
			expect(offer()).not.toHaveProperty('priceSpecification')
		})

		it.each([null, '2026-10-05T00:00:00.000Z'])(
			'hydrates across midnight and promo expiry without changing JSON-LD (ends: %s)',
			async endsAt => {
				vi.useFakeTimers({ toFake: ['Date'] })
				vi.setSystemTime(new Date(RENDERED_AT))
				const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
				const recoverable = vi.fn()
				const initialData = data({
					sale_price: 356,
					promo_percent: 15,
					promo_ends_at: endsAt
				})
				const makePage = () => (
					<QueryClientProvider
						client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
					>
						<ProductPage
							slug={initialData.variant.slug}
							initialData={initialData}
							renderedAt={RENDERED_AT}
						/>
					</QueryClientProvider>
				)
				const host = document.createElement('div')
				let root: Root | undefined
				try {
					host.innerHTML = renderToString(makePage())
					document.body.appendChild(host)
					const before = host.querySelector(
						'script[type="application/ld+json"]'
					)!.textContent
					vi.setSystemTime(new Date('2026-10-05T00:00:30.000Z'))
					await act(async () => {
						root = hydrateRoot(host, makePage(), { onRecoverableError: recoverable })
					})
					expect(errors).not.toHaveBeenCalled()
					expect(recoverable).not.toHaveBeenCalled()
					expect(
						host.querySelector('script[type="application/ld+json"]')!.textContent
					).toBe(before)
					expect(host.textContent).toContain('356 ₴')
				} finally {
					await act(async () => root?.unmount())
					host.remove()
					errors.mockRestore()
					vi.useRealTimers()
				}
			}
		)

		it('shows the badge, the sale price and the struck regular price, and says when it ends', () => {
			const { container } = renderPage(onSale())
			expect(screen.getByText('−15 %')).toBeInTheDocument()
			expect(screen.getByText('356 ₴')).toBeInTheDocument()
			expect(container.querySelector('s')).toHaveTextContent('419 ₴')
			expect(screen.getByText('Акція до 01.11')).toBeInTheDocument()
		})

		it('sends the sale price to analytics and the promo fields into the cart', async () => {
			const { trackViewItem, trackAddToCart } = await import('@/common/lib/ga4-events')
			const { useCartStore } = await import('@/common/store/useCartStore')
			renderPage(onSale())
			expect(trackViewItem).toHaveBeenLastCalledWith(expect.objectContaining({ price: 356 }))

			await act(async () => {
				screen.getByRole('button', { name: /Додати в кошик/ }).click()
			})
			expect(useCartStore.getState().addItem).toHaveBeenLastCalledWith(
				'v1',
				1,
				expect.objectContaining({
					price: 419,
					sale_price: 356,
					promo_ends_at: '2099-11-01T12:00:00.000Z'
				})
			)
			expect(trackAddToCart).toHaveBeenLastCalledWith(expect.objectContaining({ price: 356 }))
		})

		it('shows an archived variant with one struck price and no promotion', () => {
			const { container } = renderPage(
				data({
					status: 'archived',
					sale_price: 356,
					promo_percent: 15,
					promo_ends_at: null
				})
			)
			expect(screen.queryByText('−15 %')).not.toBeInTheDocument()
			expect(screen.queryByText('356 ₴')).not.toBeInTheDocument()
			expect(container.querySelector('s')).toBeNull()
			expect(screen.getByText('419 ₴')).toHaveClass('line-through')
		})
	})
})

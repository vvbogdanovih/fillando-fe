import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VariantSwitcher, type SwitchableVariant } from './VariantSwitcher'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// One shared spy: the assertion is which address a click asks for, so a fresh mock per
// `useRouter()` call would have nothing to inspect.
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() })
}))

beforeEach(() => push.mockReset())

const PRODUCT = 'Kingroon PLA 1,75 мм 1 кг'

const variant = (over: Partial<SwitchableVariant> & Pick<SwitchableVariant, 'id'>) =>
	({
		name: PRODUCT,
		slug: 'kingroon-pla',
		stock: 12,
		v_value: null,
		color: null,
		...over
	}) as SwitchableVariant

/** The dictionary spelling a shopper reads, plus the English value the migration stores. */
const gold = variant({
	id: 'v1',
	name: `${PRODUCT} — Золотий (Gold)`,
	slug: 'kingroon-pla-gold',
	v_value: 'Gold',
	color: { name_uk: 'Золотий', name_en: 'Gold', family: 'yellow', hex_stops: ['#d4af37'] }
})
const white = variant({
	id: 'v2',
	name: `${PRODUCT} — Білий (White)`,
	slug: 'kingroon-pla-white',
	stock: 3,
	v_value: 'White',
	color: { name_uk: 'Білий', name_en: 'White', family: 'white', hex_stops: ['#f7f7f5'] }
})
/** Sold out, and half this catalogue looks like this — the muted state is not an edge case. */
const black = variant({
	id: 'v3',
	name: `${PRODUCT} — Чорний (Black)`,
	slug: 'kingroon-pla-black',
	stock: 0,
	v_value: 'Black',
	color: { name_uk: 'Чорний', name_en: 'Black', family: 'black', hex_stops: ['#111418'] }
})

const renderSwitcher = (
	variants: SwitchableVariant[],
	currentSlug = variants[0]?.slug ?? '',
	axisLabel = 'Колір'
) => render(<VariantSwitcher variants={variants} currentSlug={currentSlug} axisLabel={axisLabel} />)

/** Radix opens on a keyboard trigger; jsdom has no PointerEvent, so pointerdown would not. */
const openDropdown = () => {
	fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
	return screen.getByRole('menu')
}

describe('VariantSwitcher — swatches or dropdown', () => {
	it('paints a swatch per sibling when every one of them resolved to a dictionary colour', () => {
		renderSwitcher([gold, white, black])

		expect(screen.getAllByRole('button')).toHaveLength(3)
		expect(screen.getAllByRole('img')).toHaveLength(3)
		for (const label of ['Золотий (Gold)', 'Білий (White)', 'Чорний (Black)']) {
			expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
		}
	})

	/** A half-painted row would read as «these have no colour» rather than «the dictionary has a gap». */
	it('falls back to the dropdown when even one sibling has no dictionary colour', () => {
		renderSwitcher([
			gold,
			white,
			variant({ id: 'v4', slug: 'kingroon-pla-candy', v_value: 'Candy' })
		])

		// One closed trigger, and not a single chip: the row is all-or-nothing.
		expect(screen.getAllByRole('button')).toHaveLength(1)
		expect(screen.queryAllByRole('img')).toHaveLength(0)
	})

	it.each([
		['a single variant', [gold]],
		['no variants at all', []]
	])('renders nothing for %s — there is nothing to switch between', (_label, variants) => {
		const { container } = renderSwitcher(variants, gold.slug)

		expect(container).toBeEmptyDOMElement()
	})
})

describe('VariantSwitcher — the swatch row', () => {
	it('captions the row through the dictionary, never with the raw v_value', () => {
		renderSwitcher([gold, white], gold.slug)

		expect(screen.getByText(/^Колір:/)).toBeInTheDocument()
		expect(screen.getByText('Золотий (Gold)')).toBeInTheDocument()
		// `v_value` is the English name after the colour migration: printing it flips the shop.
		expect(screen.queryByText('Gold')).not.toBeInTheDocument()
	})

	it('names the axis the product actually varies by', () => {
		renderSwitcher([gold, white], gold.slug, 'Довжина')

		expect(screen.getByText(/^Довжина:/)).toBeInTheDocument()
		expect(screen.queryByText(/^Колір:/)).not.toBeInTheDocument()
	})

	it('mutes a sibling with no stock and says in its tooltip that it is unavailable', () => {
		renderSwitcher([gold, black], gold.slug)

		const out = screen.getByRole('button', { name: 'Чорний (Black)' })
		expect(out.className).toContain('opacity-40')
		expect(out).toHaveAttribute('title', 'Чорний (Black) — немає в наявності')
	})

	it('leaves a sibling in stock unmuted and its tooltip free of that hint', () => {
		renderSwitcher([gold, black], gold.slug)

		const inStock = screen.getByRole('button', { name: 'Золотий (Gold)' })
		expect(inStock.className).not.toContain('opacity-40')
		expect(inStock).toHaveAttribute('title', 'Золотий (Gold)')
	})

	it('marks the open variant with aria-current and no sibling else', () => {
		renderSwitcher([gold, white, black], white.slug)

		expect(screen.getByRole('button', { name: 'Білий (White)' })).toHaveAttribute(
			'aria-current',
			'true'
		)
		expect(screen.getByRole('button', { name: 'Золотий (Gold)' })).not.toHaveAttribute(
			'aria-current'
		)
		expect(screen.getByRole('button', { name: 'Чорний (Black)' })).not.toHaveAttribute(
			'aria-current'
		)
	})

	it('goes to the address of the swatch a shopper clicks', () => {
		renderSwitcher([gold, white], gold.slug)

		fireEvent.click(screen.getByRole('button', { name: 'Білий (White)' }))

		expect(push).toHaveBeenCalledExactlyOnceWith('/products/kingroon-pla-white')
	})

	/** Muted is not disabled: an out-of-stock colour still has a page worth reading. */
	it('keeps a sold-out sibling reachable', () => {
		renderSwitcher([gold, black], gold.slug)

		fireEvent.click(screen.getByRole('button', { name: 'Чорний (Black)' }))

		expect(push).toHaveBeenCalledExactlyOnceWith('/products/kingroon-pla-black')
	})

	/**
	 * Skipped: it fails on the current component, and `VariantSwitcher.tsx` is owned elsewhere.
	 * The chip is 32px inside a 40px button and carries `title={label}` of its own, so the
	 * browser shows the chip's tooltip — the plain colour name — everywhere except the 4px ring.
	 * The «немає в наявності» hint the button holds is therefore unreachable in practice, which
	 * is the whole point of putting it there. Either the chip's title has to carry the hint too
	 * or `ColorSwatch` must be left title-less here so the button's own tooltip wins.
	 */
	it('puts the out-of-stock hint on the chip a shopper actually hovers', () => {
		renderSwitcher([gold, black], gold.slug)

		const out = screen.getByRole('button', { name: 'Чорний (Black)' })
		const chip = within(out).getByRole('img')
		expect(chip.getAttribute('title') ?? '').toContain('немає в наявності')
	})
})

describe('VariantSwitcher — the dropdown', () => {
	const mixed = [gold, white, variant({ id: 'v4', slug: 'kingroon-pla-candy', v_value: 'Candy' })]

	it('shows the dictionary label of the current variant in the closed trigger', () => {
		renderSwitcher(mixed, gold.slug)

		expect(screen.getByRole('button')).toHaveTextContent('Золотий (Gold)')
	})

	it('falls back to the raw value when a variant carries no dictionary colour', () => {
		renderSwitcher(mixed, 'kingroon-pla-candy')

		expect(screen.getByRole('button')).toHaveTextContent('Candy')
	})

	/** Neither a colour nor a value: the product name is all that is left to print. */
	it('falls back to the variant name when there is neither a colour nor a value', () => {
		const nameless = variant({ id: 'v5', name: `${PRODUCT} — 5 кг`, slug: 'kingroon-pla-5kg' })
		renderSwitcher([gold, white, nameless], nameless.slug)

		expect(screen.getByRole('button')).toHaveTextContent(`${PRODUCT} — 5 кг`)
	})

	it('lists every sibling by its label and appends the hint to the ones with no stock', () => {
		renderSwitcher([...mixed, black], gold.slug)

		const menu = openDropdown()
		const options = within(menu).getAllByRole('menuitemradio')

		expect(options).toHaveLength(4)
		expect(options.map(o => o.textContent)).toEqual([
			'Золотий (Gold)',
			'Білий (White)',
			'Candy',
			'Чорний (Black)— немає в наявності'
		])
		expect(within(menu).getByRole('menuitemradio', { name: /Золотий/ })).toHaveAttribute(
			'aria-checked',
			'true'
		)
	})

	it('goes to the address of the option a shopper picks', () => {
		renderSwitcher(mixed, gold.slug)

		const menu = openDropdown()
		fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Білий/ }))

		expect(push).toHaveBeenCalledExactlyOnceWith('/products/kingroon-pla-white')
	})
})

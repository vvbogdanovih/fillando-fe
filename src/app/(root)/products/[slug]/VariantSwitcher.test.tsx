import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { VariantSwitcher, type SwitchableVariant } from './VariantSwitcher'
afterEach(cleanup)
const color = { name_uk: 'Чорний', name_en: 'Black', family: 'black', hex_stops: ['#000000'] }
const variant = (id: string, over: Partial<SwitchableVariant> = {}): SwitchableVariant => ({
	id,
	name: `Товар ${id}`,
	slug: `product-${id}`,
	stock: 3,
	v_value: id,
	color: null,
	...over
})
describe('VariantSwitcher', () => {
	it('renders crawlable colour links including sold-out variants', () => {
		render(
			<VariantSwitcher
				variants={[
					variant('black', { color }),
					variant('white', {
						color: { ...color, name_uk: 'Білий', name_en: 'White' },
						stock: 0
					})
				]}
				currentSlug='product-black'
				axisLabel='Колір'
			/>
		)
		expect(screen.getAllByRole('link')).toHaveLength(2)
		expect(screen.getByRole('link', { name: 'Чорний (Black)' })).toHaveAttribute(
			'aria-current',
			'page'
		)
		const sold = screen.getByRole('link', { name: 'Білий (White)' })
		expect(sold).toHaveAttribute('href', '/products/product-white')
		expect(sold).toHaveClass('opacity-40')
		expect(sold).toHaveAttribute('title', 'Білий (White) — немає в наявності')
		expect(sold.querySelector('[role="img"]')).toHaveAttribute(
			'title',
			'Білий (White) — немає в наявності'
		)
	})
	it('includes non-colour hrefs in server HTML without opening a portal or JavaScript', () => {
		const html = renderToStaticMarkup(
			<VariantSwitcher
				variants={[
					variant('small', { v_value: '150 × 180 см' }),
					variant('large', { v_value: '180 × 200 см', stock: 0 })
				]}
				currentSlug='product-small'
				axisLabel='Розмір'
			/>
		)
		expect(html).toContain('<details')
		expect(html).toContain('href="/products/product-small"')
		expect(html).toContain('href="/products/product-large"')
		expect(html).toContain('150 × 180 см')
		expect(html).toContain('немає в наявності')
	})
	it('uses text choices if a dictionary colour is missing and retains the name fallback', () => {
		const { container } = render(
			<VariantSwitcher
				variants={[
					variant('black', { color }),
					variant('other', { v_value: null, name: 'Особливий варіант' })
				]}
				currentSlug='product-other'
				axisLabel='Варіант'
			/>
		)
		expect(container.querySelector('summary')).toHaveTextContent('Особливий варіант')
		expect(container.querySelectorAll('[role="img"]')).toHaveLength(0)
		expect(container.querySelectorAll('a')).toHaveLength(2)
	})
	it.each([{ variants: [] }, { variants: [variant('one')] }])(
		'renders no selector without alternative variants',
		({ variants }) => {
			const { container } = render(
				<VariantSwitcher
					variants={variants}
					currentSlug='product-one'
					axisLabel='Варіант'
				/>
			)
			expect(container).toBeEmptyDOMElement()
		}
	)
})

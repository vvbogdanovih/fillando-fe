import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import { SITE_URL } from '@/common/constants/seo.constants'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

const TRAIL: Crumb[] = [
	{ name: 'Головна', href: '/' },
	{ name: 'Філамент', href: '/filament' },
	{ name: 'PLA Basic — Чорний', href: '/products/pla-basic-black' }
]

const readSchema = (container: HTMLElement) => {
	const script = container.querySelector('script[type="application/ld+json"]')
	return JSON.parse(script?.textContent ?? '{}') as {
		'@type': string
		itemListElement: { position: number; name: string; item: string }[]
	}
}

describe('Breadcrumbs', () => {
	it('renders every crumb, with the last one as plain text', () => {
		render(<Breadcrumbs items={TRAIL} />)

		expect(screen.getByRole('link', { name: 'Головна' })).toHaveAttribute('href', '/')
		expect(screen.getByRole('link', { name: 'Філамент' })).toHaveAttribute('href', '/filament')
		// The page you are on is not a link to itself.
		expect(screen.queryByRole('link', { name: 'PLA Basic — Чорний' })).toBeNull()
		expect(screen.getByText('PLA Basic — Чорний')).toHaveAttribute('aria-current', 'page')
	})

	it('emits a BreadcrumbList that matches the visible trail exactly', () => {
		// This is the whole point of the component: the product page used to show two crumbs
		// while its markup claimed three, and the two were written in different places.
		const { container } = render(<Breadcrumbs items={TRAIL} />)
		const schema = readSchema(container)

		expect(schema['@type']).toBe('BreadcrumbList')
		expect(schema.itemListElement).toHaveLength(TRAIL.length)
		expect(schema.itemListElement.map(i => i.name)).toEqual(TRAIL.map(c => c.name))
	})

	it('numbers the list from one, in order', () => {
		const { container } = render(<Breadcrumbs items={TRAIL} />)

		expect(readSchema(container).itemListElement.map(i => i.position)).toEqual([1, 2, 3])
	})

	it('gives every crumb an absolute URL, including the current page', () => {
		const { container } = render(<Breadcrumbs items={TRAIL} />)

		expect(readSchema(container).itemListElement.map(i => i.item)).toEqual([
			`${SITE_URL}/`,
			`${SITE_URL}/filament`,
			`${SITE_URL}/products/pla-basic-black`
		])
	})

	it('counts the visible separators as one fewer than the crumbs', () => {
		const { container } = render(<Breadcrumbs items={TRAIL} />)
		const separators = [...container.querySelectorAll('[aria-hidden="true"]')]

		expect(separators).toHaveLength(TRAIL.length - 1)
	})

	it('handles a two-crumb trail, which is what the catalogue renders', () => {
		const { container } = render(<Breadcrumbs items={TRAIL.slice(0, 2)} />)

		expect(readSchema(container).itemListElement).toHaveLength(2)
		expect(screen.getByText('Філамент')).toHaveAttribute('aria-current', 'page')
	})
})

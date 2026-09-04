import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Pagination } from './Pagination'

let currentPath = '/filament'
let currentQuery = ''

vi.mock('next/navigation', () => ({
	usePathname: () => currentPath,
	useSearchParams: () => new URLSearchParams(currentQuery)
}))

afterEach(() => {
	cleanup()
	currentPath = '/filament'
	currentQuery = ''
})

const paginate = (page: number, totalPages: number) => ({
	total: totalPages * 12,
	page,
	limit: 12,
	totalPages
})

const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href')

describe('Pagination — every page is a crawlable link', () => {
	it('renders anchors, not buttons', () => {
		// A crawler follows anchors and never clicks: as buttons, nothing past page 1 of any
		// category was reachable at all.
		render(<Pagination pagination={paginate(1, 3)} />)

		expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
		expect(screen.queryAllByRole('button')).toHaveLength(0)
	})

	it('links page 1 to the bare address, with no ?page=1', () => {
		render(<Pagination pagination={paginate(2, 3)} />)

		expect(hrefOf('Сторінка 1')).toBe('/filament')
	})

	it('numbers the other pages in the query', () => {
		render(<Pagination pagination={paginate(1, 3)} />)

		expect(hrefOf('Сторінка 2')).toBe('/filament?page=2')
		expect(hrefOf('Сторінка 3')).toBe('/filament?page=3')
	})

	it('keeps the filters that are already in the URL', () => {
		currentQuery = 'polymer=PLA&limit=24'
		render(<Pagination pagination={paginate(1, 3)} />)

		const href = hrefOf('Сторінка 2') ?? ''
		expect(href).toContain('polymer=PLA')
		expect(href).toContain('limit=24')
		expect(href).toContain('page=2')
	})

	it('replaces an existing page parameter rather than appending a second one', () => {
		currentQuery = 'page=2'
		render(<Pagination pagination={paginate(2, 5)} />)

		expect(hrefOf('Сторінка 3')).toBe('/filament?page=3')
	})

	it('works on any path, so the search page gets the same behaviour', () => {
		currentPath = '/search'
		currentQuery = 'q=pla'
		render(<Pagination pagination={paginate(1, 2)} />)

		expect(hrefOf('Сторінка 2')).toBe('/search?q=pla&page=2')
	})
})

describe('Pagination — previous and next', () => {
	it('offers rel=prev and rel=next in the middle of the range', () => {
		render(<Pagination pagination={paginate(2, 3)} />)

		expect(screen.getByRole('link', { name: 'Попередня сторінка' })).toHaveAttribute(
			'rel',
			'prev'
		)
		expect(screen.getByRole('link', { name: 'Наступна сторінка' })).toHaveAttribute(
			'rel',
			'next'
		)
	})

	it('renders no previous link on the first page', () => {
		render(<Pagination pagination={paginate(1, 3)} />)

		expect(screen.queryByRole('link', { name: 'Попередня сторінка' })).toBeNull()
	})

	it('renders no next link on the last page', () => {
		render(<Pagination pagination={paginate(3, 3)} />)

		expect(screen.queryByRole('link', { name: 'Наступна сторінка' })).toBeNull()
	})

	it('marks the current page for assistive technology', () => {
		render(<Pagination pagination={paginate(2, 3)} />)

		expect(screen.getByRole('link', { name: 'Сторінка 2' })).toHaveAttribute(
			'aria-current',
			'page'
		)
	})
})

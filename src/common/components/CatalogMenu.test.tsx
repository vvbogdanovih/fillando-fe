import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogMenu } from './CatalogMenu'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const categories = [
	{
		href: '/electrical',
		label: 'Електротовари',
		children: [
			{
				href: '/transfer-switches',
				label: 'АВР',
				children: [{ href: '/ats-home', label: 'АВР для дому' }]
			}
		]
	},
	{ href: '/filament', label: 'Філамент' }
]
const panel = () => screen.getByRole('button', { name: 'Категорії каталогу' })

describe('«Каталог» panel under the header', () => {
	beforeEach(() => {
		pathname = '/'
		vi.useFakeTimers()
	})
	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it('keeps the whole tree in the markup while closed, so crawlers still get the links', () => {
		render(<CatalogMenu categories={categories} />)
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
		for (const [name, href] of [
			['Каталог', '/catalog'],
			['Електротовари', '/electrical'],
			['АВР', '/transfer-switches'],
			['АВР для дому', '/ats-home'],
			['Філамент', '/filament'],
			['Увесь каталог →', '/catalog']
		])
			expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
	})

	it('opens on hover and closes shortly after the pointer leaves', () => {
		const { container } = render(<CatalogMenu categories={categories} />)
		const root = container.firstElementChild!
		fireEvent.pointerEnter(root, { pointerType: 'mouse' })
		expect(panel()).toHaveAttribute('aria-expanded', 'true')
		fireEvent.pointerLeave(root, { pointerType: 'mouse' })
		expect(panel()).toHaveAttribute('aria-expanded', 'true')
		act(() => void vi.advanceTimersByTime(200))
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
	})

	it('toggles on the chevron for touch screens and closes on Escape', () => {
		render(<CatalogMenu categories={categories} />)
		fireEvent.click(panel())
		expect(panel()).toHaveAttribute('aria-expanded', 'true')
		fireEvent.keyDown(panel(), { key: 'Escape' })
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
	})

	// Owner decision 31.10.2026: focus never opens the panel, so Tab walks the header, not the
	// whole tree; the chevron (a button: Enter/Space) opens it, Escape closes it.
	it('does not open on keyboard focus; the closed panel stays out of the Tab order', () => {
		render(<CatalogMenu categories={categories} />)
		const label = screen.getByRole('link', { name: 'Каталог' })
		fireEvent.focus(label)
		label.focus()
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
		expect(document.getElementById(panel().getAttribute('aria-controls')!)).toHaveClass(
			'invisible'
		)
		panel().focus()
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
	})

	it('Escape inside the panel closes it and returns focus to the chevron', () => {
		render(<CatalogMenu categories={categories} />)
		fireEvent.click(panel())
		const link = screen.getByRole('link', { name: 'АВР для дому' })
		link.focus()
		fireEvent.keyDown(link, { key: 'Escape' })
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
		expect(document.activeElement).toBe(panel())
	})

	it('a tap opens it once: the emulated pointer of a touch does not toggle it back', () => {
		const { container } = render(<CatalogMenu categories={categories} />)
		const root = container.firstElementChild!
		// What a mobile browser sends for one tap on the chevron: the touch pointer, then the
		// emulated mouse events, then the click.
		fireEvent.pointerEnter(root, { pointerType: 'touch' })
		fireEvent.mouseEnter(root)
		fireEvent.mouseOver(panel())
		expect(panel()).toHaveAttribute('aria-expanded', 'false')
		fireEvent.click(panel())
		expect(panel()).toHaveAttribute('aria-expanded', 'true')
	})

	it('highlights «Каталог» and marks the current category inside the tree', () => {
		pathname = '/filament/pla'
		render(<CatalogMenu categories={categories} />)
		expect(screen.getByRole('link', { name: 'Каталог' })).toHaveClass('font-semibold')
		expect(screen.getByRole('link', { name: 'Філамент' })).toHaveAttribute(
			'aria-current',
			'page'
		)
		expect(screen.getByRole('link', { name: 'АВР' })).not.toHaveAttribute('aria-current')
	})
})

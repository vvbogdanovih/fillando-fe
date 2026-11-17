import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/filament', search: '' }))
vi.mock('next/navigation', () => ({
	usePathname: () => nav.pathname,
	useSearchParams: () => new URLSearchParams(nav.search)
}))
import { NavigationProgress, navigationTarget, startNavigationProgress } from './NavigationProgress'

const location = {
	href: 'http://localhost/filament?color=black',
	origin: 'http://localhost',
	pathname: '/filament',
	search: '?color=black'
}
function link(attributes: Record<string, string>) {
	const anchor = document.createElement('a')
	for (const [key, value] of Object.entries(attributes)) anchor.setAttribute(key, value)
	const inner = document.createElement('span')
	anchor.append(inner)
	document.body.append(anchor)
	return inner
}
const click = (target: Element, extra: Partial<MouseEvent> = {}) => ({
	button: 0,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	target,
	...extra
})
const bar = (container: HTMLElement) => container.querySelector('[data-state]')!

beforeEach(() => {
	vi.useFakeTimers()
	nav.pathname = '/filament'
	nav.search = ''
})
afterEach(() => {
	cleanup()
	vi.useRealTimers()
	document.body.innerHTML = ''
})

describe('navigationTarget', () => {
	it('accepts a plain click on an internal link to another page', () => {
		expect(navigationTarget(click(link({ href: '/products/pla-black' })), location)).toBe(
			'/products/pla-black'
		)
		expect(navigationTarget(click(link({ href: '/filament?color=white' })), location)).toBe(
			'/filament?color=white'
		)
	})

	it('ignores new tabs, downloads, other origins, the same page and in-page anchors', () => {
		const same = link({ href: '/filament?color=black' })
		for (const event of [
			click(link({ href: '/catalog', target: '_blank' })),
			click(link({ href: '/price.pdf', download: '' })),
			click(link({ href: 'https://example.com/x' })),
			click(same),
			click(link({ href: '/filament?color=black#reviews' })),
			click(link({ href: '/catalog' }), { metaKey: true }),
			click(link({ href: '/catalog' }), { button: 1 }),
			click(document.body)
		])
			expect(navigationTarget(event, location)).toBeNull()
	})
})

describe('NavigationProgress', () => {
	it('shows only after a short delay and completes when the URL changes', () => {
		const view = render(<NavigationProgress />)
		expect(bar(view.container).getAttribute('data-state')).toBe('idle')
		act(() => startNavigationProgress())
		act(() => void vi.advanceTimersByTime(119))
		expect(bar(view.container).getAttribute('data-state')).toBe('idle')
		act(() => void vi.advanceTimersByTime(1))
		expect(bar(view.container).getAttribute('data-state')).toBe('loading')
		nav.pathname = '/filament/pla'
		view.rerender(<NavigationProgress />)
		expect(bar(view.container).getAttribute('data-state')).toBe('done')
		act(() => void vi.advanceTimersByTime(300))
		expect(bar(view.container).getAttribute('data-state')).toBe('idle')
	})

	it('never flashes for a navigation faster than the delay', () => {
		const view = render(<NavigationProgress />)
		act(() => startNavigationProgress())
		act(() => void vi.advanceTimersByTime(50))
		nav.search = 'color=black'
		view.rerender(<NavigationProgress />)
		act(() => void vi.advanceTimersByTime(500))
		expect(bar(view.container).getAttribute('data-state')).toBe('idle')
	})

	it('starts on an internal link click and gives up when the URL never changes', () => {
		const view = render(<NavigationProgress />)
		const target = link({ href: '/catalog' })
		// As next/link does: the native navigation is cancelled after the capture listener ran.
		target.closest('a')!.addEventListener('click', event => event.preventDefault())
		act(() => {
			target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
		})
		act(() => void vi.advanceTimersByTime(200))
		expect(bar(view.container).getAttribute('data-state')).toBe('loading')
		act(() => void vi.advanceTimersByTime(10_000))
		expect(bar(view.container).getAttribute('data-state')).toBe('done')
	})
})

describe('startNavigationProgress', () => {
	it('starts nothing for a push to the current URL', () => {
		window.history.replaceState(null, '', '/filament?color=black')
		const view = render(<NavigationProgress />)
		act(() => startNavigationProgress('/filament?color=black'))
		act(() => void vi.advanceTimersByTime(500))
		expect(bar(view.container).getAttribute('data-state')).toBe('idle')
		act(() => startNavigationProgress('?color=white'))
		act(() => void vi.advanceTimersByTime(500))
		expect(bar(view.container).getAttribute('data-state')).toBe('loading')
	})
})

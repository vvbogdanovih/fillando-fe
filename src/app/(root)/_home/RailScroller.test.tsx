import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RailScroller } from './RailScroller'

afterEach(cleanup)

/** jsdom lays nothing out: the row's sizes are set by hand. */
const size = (el: HTMLElement, sizes: { scrollWidth: number; clientWidth: number }) => {
	for (const [key, value] of Object.entries(sizes))
		Object.defineProperty(el, key, { configurable: true, value })
}

describe('RailScroller — an arrow with nowhere to go is not shown (owner, 2026-11-14)', () => {
	it('starts without «попередні», shows it once the row has moved, drops «наступні» at the end', () => {
		render(
			<RailScroller label='Новинки'>
				<div>card</div>
			</RailScroller>
		)
		const row = screen.getByRole('region', { name: 'Новинки' })
		const prev = screen.getByRole('button', { name: 'Новинки: попередні', hidden: true })
		const next = screen.getByRole('button', { name: 'Новинки: наступні', hidden: true })
		size(row, { scrollWidth: 1600, clientWidth: 800 })
		act(() => {
			fireEvent.scroll(row, { target: { scrollLeft: 0 } })
		})
		expect(prev.className).toContain('invisible')
		expect(prev).toBeDisabled()
		expect(next.className).not.toContain('invisible')
		expect(next).toBeEnabled()

		act(() => {
			fireEvent.scroll(row, { target: { scrollLeft: 300 } })
		})
		expect(prev.className).not.toContain('invisible')
		expect(next.className).not.toContain('invisible')

		act(() => {
			fireEvent.scroll(row, { target: { scrollLeft: 800 } })
		})
		expect(prev).toBeEnabled()
		expect(next.className).toContain('invisible')
		expect(next).toBeDisabled()
	})

	it('shows no arrow at all when every card fits', () => {
		render(
			<RailScroller label='Новинки'>
				<div>card</div>
			</RailScroller>
		)
		const row = screen.getByRole('region', { name: 'Новинки' })
		size(row, { scrollWidth: 800, clientWidth: 800 })
		act(() => {
			fireEvent.scroll(row, { target: { scrollLeft: 0 } })
		})
		for (const name of ['Новинки: попередні', 'Новинки: наступні'])
			expect(screen.getByRole('button', { name, hidden: true }).className).toContain(
				'invisible'
			)
	})

	// The page scrolls through Lenis, which takes every wheel event with a vertical part — and a
	// sideways swipe on a touchpad has one. The row asks to be left its own.
	it('keeps a sideways wheel or touchpad gesture for itself, not for the page scroll', () => {
		render(
			<RailScroller label='Новинки'>
				<div>card</div>
			</RailScroller>
		)
		expect(screen.getByRole('region', { name: 'Новинки' })).toHaveAttribute(
			'data-lenis-prevent-horizontal'
		)
	})

	it('is «Новинки» wide by default — six cards from `lg` — and as wide as its page says otherwise', () => {
		const { unmount } = render(
			<RailScroller label='Новинки'>
				<div>card</div>
			</RailScroller>
		)
		expect(screen.getByRole('region', { name: 'Новинки' }).className).toContain(
			'lg:auto-cols-[calc((100%-5*0.75rem)/6)]'
		)
		unmount()
		render(
			<RailScroller label='Обрані' columns='auto-cols-[50%]'>
				<div>card</div>
			</RailScroller>
		)
		const row = screen.getByRole('region', { name: 'Обрані' })
		expect(row.className).toContain('auto-cols-[50%]')
		expect(row.className).not.toContain('/6)')
		// What makes it a row that scrolls is not the caller's to repeat.
		expect(row.className).toContain('overflow-x-auto')
		expect(row.className).toContain('grid-flow-col')
	})
})

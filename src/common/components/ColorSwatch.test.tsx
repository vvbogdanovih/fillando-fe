import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ColorSwatch, swatchBackground } from './ColorSwatch'

afterEach(cleanup)

/**
 * The fill is derived from the stops rather than a stored flag (TD-0002 §5.2.2), so this rule is
 * the whole contract between the dictionary and every place a colour is drawn — the admin
 * preview, the variant picker and the storefront filter.
 */
describe('swatchBackground', () => {
	it('paints a single stop as a solid colour, not a one-stop gradient', () => {
		expect(swatchBackground(['#111111'])).toBe('#111111')
	})

	it('paints two or more stops as a linear gradient', () => {
		expect(swatchBackground(['#111111', '#eeeeee'])).toBe(
			'linear-gradient(135deg, #111111, #eeeeee)'
		)
	})

	it('paints multicolor as a conic gradient that closes back on the first stop', () => {
		// A rainbow has to read as a ring; a linear gradient of five colours just looks like a
		// badly chosen two-tone at 24px.
		expect(swatchBackground(['#e53e3e', '#ecc94b', '#38a169'], 'multicolor')).toBe(
			'conic-gradient(#e53e3e, #ecc94b, #38a169, #e53e3e)'
		)
	})

	it('keeps a single multicolor stop solid — one colour cannot be a ring', () => {
		expect(swatchBackground(['#e53e3e'], 'multicolor')).toBe('#e53e3e')
	})

	it('preserves the order it was given, since the first stop is the primary colour', () => {
		expect(swatchBackground(['#aaaaaa', '#bbbbbb'])).toContain('#aaaaaa, #bbbbbb')
		expect(swatchBackground(['#bbbbbb', '#aaaaaa'])).toContain('#bbbbbb, #aaaaaa')
	})

	it.each([
		['no stops', [] as string[]],
		['only blanks', ['', '']]
	])('falls back to transparent for %s rather than emitting broken CSS', (_case, stops) => {
		expect(swatchBackground(stops)).toBe('transparent')
	})

	it('ignores blank entries mixed in with real ones', () => {
		expect(swatchBackground(['#111111', ''])).toBe('#111111')
	})
})

describe('ColorSwatch', () => {
	it('exposes the colour name to assistive technology', () => {
		render(<ColorSwatch hexStops={['#111111']} title='Чорний' />)

		expect(screen.getByRole('img', { name: 'Чорний' })).toBeInTheDocument()
	})

	it('falls back to a generic label when no name is given', () => {
		render(<ColorSwatch hexStops={['#111111']} />)

		expect(screen.getByRole('img', { name: 'Колір' })).toBeInTheDocument()
	})

	it('renders at the requested size', () => {
		render(<ColorSwatch hexStops={['#111111']} size={40} title='Чорний' />)

		expect(screen.getByRole('img', { name: 'Чорний' })).toHaveStyle({
			width: '40px',
			height: '40px'
		})
	})

	it('keeps a border so a white swatch is still visible on a white panel', () => {
		render(<ColorSwatch hexStops={['#ffffff']} title='Білий' />)

		expect(screen.getByRole('img', { name: 'Білий' }).className).toContain('border')
	})
})

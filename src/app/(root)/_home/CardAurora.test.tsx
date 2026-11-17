import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cutOf } from './aurora-cards'
import { CardAurora } from './CardAurora'

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

describe('CardAurora — the live background of the dark home page cards (owner, 2026-11-14)', () => {
	it('without a canvas context leaves a hidden decorative canvas over the CSS gradient and starts nothing', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
		const frame = vi.spyOn(window, 'requestAnimationFrame')
		const { container, unmount } = render(<CardAurora shift={0.3} />)
		const canvas = container.querySelector('canvas')!
		expect(canvas).toHaveAttribute('aria-hidden')
		// Never shown until a frame is on it: the card keeps its gradient.
		expect(canvas.dataset.ready).toBeUndefined()
		expect(canvas.className).toContain('opacity-0')
		expect(frame).not.toHaveBeenCalled()
		unmount()
	})
})

describe('cutOf — each card shows its own cut of the one shared field (480 × 300)', () => {
	it("gives a wide band the field's whole width and a thin strip of its height", () => {
		const cut = cutOf({ width: 624, height: 48, shift: 0.5 })
		expect(cut.width).toBe(480)
		expect(cut.height).toBeCloseTo(480 / 13, 5)
		expect(cut.x).toBe(0)
	})

	it("gives a tall cover the field's whole height and its own proportions", () => {
		const cut = cutOf({ width: 116, height: 197, shift: 0.5 })
		expect(cut.height).toBeCloseTo(300, 5)
		expect(cut.width / cut.height).toBeCloseTo(116 / 197, 5)
	})

	it('places two covers on different parts of the field, never outside it', () => {
		const a = cutOf({ width: 116, height: 197, shift: 0.15 })
		const b = cutOf({ width: 116, height: 197, shift: 0.52 })
		expect(a.x).not.toBe(b.x)
		for (const cut of [a, b, cutOf({ width: 116, height: 197, shift: 1 })]) {
			expect(cut.x).toBeGreaterThanOrEqual(0)
			expect(cut.x + cut.width).toBeLessThanOrEqual(480 + 1e-6)
			expect(cut.y).toBeGreaterThanOrEqual(0)
			expect(cut.y + cut.height).toBeLessThanOrEqual(300 + 1e-6)
		}
	})
})

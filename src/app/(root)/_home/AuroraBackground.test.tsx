import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuroraBackground } from './AuroraBackground'

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

it('without WebGL leaves a hidden decorative canvas over the CSS gradient and starts nothing', () => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
	const frame = vi.spyOn(window, 'requestAnimationFrame')
	const { container, unmount } = render(<AuroraBackground />)
	const canvas = container.querySelector('canvas')!
	expect(canvas).toHaveAttribute('aria-hidden')
	// Never shown until a frame was drawn: the banner keeps its gradient.
	expect(canvas.dataset.ready).toBeUndefined()
	expect(canvas.className).toContain('opacity-0')
	expect(frame).not.toHaveBeenCalled()
	unmount()
})

/**
 * A browser stubbed just enough to run the banner: a WebGL context that links, an intersection
 * observer driven by hand, frames flushed by hand, the idle start on a timer.
 */
describe('with WebGL', () => {
	let frames: FrameRequestCallback[] = []
	let seen: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {}
	const loseContext = vi.fn()

	function start(ui = <AuroraBackground />) {
		frames = []
		loseContext.mockClear()
		vi.useFakeTimers()
		const gl = new Proxy({} as Record<string, unknown>, {
			get: (_, key) =>
				key === 'getProgramParameter'
					? () => true
					: key === 'getExtension'
						? () => ({ loseContext })
						: typeof key === 'string'
							? () => ({})
							: undefined
		})
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as never)
		vi.stubGlobal('matchMedia', () => ({ matches: false }))
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(callback: typeof seen) {
					seen = callback
				}
				observe() {}
				disconnect() {}
			}
		)
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
			frames.push(callback)
		)
		vi.stubGlobal('cancelAnimationFrame', () => {
			frames = []
		})
		const view = render(ui)
		// The idle start (no `requestIdleCallback` in jsdom: a timer).
		vi.advanceTimersByTime(300)
		return { canvas: view.container.querySelector('canvas')!, unmount: view.unmount }
	}
	const run = (count: number) => {
		for (let i = 0; i < count; i++)
			for (const frame of frames.splice(0)) frame(performance.now())
	}

	it('draws while on screen', () => {
		const { canvas } = start()
		expect(canvas.dataset.ready).toBe('true')
		run(3)
		expect(frames).toHaveLength(1)
	})

	it('stops when the context is lost and gives the banner back to its gradient', () => {
		const { canvas } = start()
		run(2)
		canvas.dispatchEvent(new Event('webglcontextlost'))
		expect(frames).toHaveLength(0)
		expect(canvas.dataset.ready).toBeUndefined()
		document.dispatchEvent(new Event('visibilitychange'))
		seen([{ isIntersecting: true }])
		run(3)
		expect(frames).toHaveLength(0)
	})

	it('believes the latest of several intersection entries delivered at once', () => {
		start()
		run(1)
		// Off screen is the news; the entry before it is history.
		seen([{ isIntersecting: true }, { isIntersecting: false }])
		run(3)
		expect(frames).toHaveLength(0)
	})

	// A browser keeps a handful of WebGL contexts and drops the oldest past that. Each visit to
	// the home page made one more and left it to the garbage collector — the cards' shared one,
	// the oldest alive, was the one to go.
	it('releases its context once the canvas is gone', () => {
		const { unmount } = start()
		vi.runOnlyPendingTimers()
		expect(loseContext).not.toHaveBeenCalled()
		unmount()
		vi.runOnlyPendingTimers()
		expect(loseContext).toHaveBeenCalledTimes(1)
	})

	it('keeps the context of a canvas that stays: development runs the effect twice on it', () => {
		const { canvas, unmount } = start(
			<StrictMode>
				<AuroraBackground />
			</StrictMode>
		)
		vi.runOnlyPendingTimers()
		expect(loseContext).not.toHaveBeenCalled()
		expect(canvas.dataset.ready).toBe('true')
		unmount()
		vi.runOnlyPendingTimers()
		expect(loseContext).toHaveBeenCalled()
	})
})

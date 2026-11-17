import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The shared «Аврора» of the dark cards over a browser stubbed just enough to run it: a WebGL
 * context that links, observers driven by hand, frames flushed by hand. The module keeps its field
 * and its loop at module level, so every test imports it afresh.
 */
const gl = () =>
	new Proxy({} as Record<string, unknown>, {
		get: (_, key) =>
			key === 'getProgramParameter'
				? () => true
				: typeof key === 'string'
					? () => ({})
					: undefined
	})

let reduced = false
let hidden = false
let frames: FrameRequestCallback[] = []
let seen: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {}
let fieldCanvas: HTMLCanvasElement | undefined
let paints = 0

beforeEach(() => {
	vi.resetModules()
	reduced = false
	hidden = false
	frames = []
	fieldCanvas = undefined
	paints = 0
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
		this: HTMLCanvasElement,
		type: string
	) {
		if (type === 'webgl') {
			fieldCanvas = this
			return gl()
		}
		return { drawImage: () => paints++ }
	} as never)
	vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
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
	vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
})
afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

/** One card on screen. */
async function mountCard() {
	const { mountCardAurora } = await import('./aurora-cards')
	const canvas = document.createElement('canvas')
	canvas.getBoundingClientRect = () => ({ width: 232, height: 200 }) as DOMRect
	const unmount = mountCardAurora(canvas, 0.5)
	seen([{ isIntersecting: true }])
	return { canvas, unmount }
}
/** `count` animation frames, each running what the one before asked for. */
const run = (count: number) => {
	for (let i = 0; i < count; i++) for (const frame of frames.splice(0)) frame(performance.now())
}
const switchTab = () => {
	hidden = true
	document.dispatchEvent(new Event('visibilitychange'))
	hidden = false
	document.dispatchEvent(new Event('visibilitychange'))
}

describe('aurora-cards — one field for every dark card', () => {
	it('paints a card on screen every frame, and nothing while the tab is hidden', async () => {
		const { unmount } = await mountCard()
		run(3)
		expect(paints).toBe(4)
		hidden = true
		document.dispatchEvent(new Event('visibilitychange'))
		run(3)
		expect(paints).toBe(5)
		expect(frames).toHaveLength(0)
		hidden = false
		document.dispatchEvent(new Event('visibilitychange'))
		run(2)
		expect(paints).toBe(7)
		unmount()
	})

	// «Менше руху» is one still frame — and stays one. The way back from another tab used to start
	// the loop: the tab's listener scheduled a frame without asking (review 2026-11-14).
	it('stays one still frame under «менше руху», after a tab switch too', async () => {
		reduced = true
		const { unmount } = await mountCard()
		run(3)
		expect(paints).toBe(1)
		switchTab()
		run(60)
		expect(paints).toBe(1)
		expect(frames).toHaveLength(0)
		unmount()
	})

	it('stops when the WebGL context is lost: no frame is asked for over a field that draws nothing', async () => {
		const { canvas, unmount } = await mountCard()
		run(2)
		expect(frames).toHaveLength(1)
		fieldCanvas!.dispatchEvent(new Event('webglcontextlost'))
		expect(frames).toHaveLength(0)
		const painted = paints
		switchTab()
		seen([{ isIntersecting: true }])
		run(5)
		expect(paints).toBe(painted)
		expect(frames).toHaveLength(0)
		// The card keeps its last frame.
		expect(canvas.dataset.ready).toBe('true')
		unmount()
	})

	it('believes the latest of several intersection entries delivered at once', async () => {
		const { unmount } = await mountCard()
		run(1)
		// On screen and off again before the browser reported either: the card is off screen.
		seen([{ isIntersecting: true }, { isIntersecting: false }])
		const painted = paints
		run(5)
		expect(paints).toBe(painted)
		expect(frames).toHaveLength(0)
		unmount()
	})
})

describe('the field shader', () => {
	// A 16-bit `mediump` (most phone GPUs honour it) cannot hold the hash's products: the noise
	// loses its fine octaves and rows of a 300 px field overflow.
	it('asks for high precision where the GPU has it, and falls back where it has not', async () => {
		const { AURORA_FIELD } = await import('./AuroraBackground')
		expect(
			AURORA_FIELD.startsWith(
				'#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n'
			)
		).toBe(true)
	})
})

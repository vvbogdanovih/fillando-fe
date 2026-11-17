import { AURORA_FIELD, AURORA_VERTEX } from './AuroraBackground'

/**
 * «Аврора» behind the home page's dark cards — the band and the shelves' covers (owner,
 * 2026-11-14: «цим карткам теж треба гарний живий фон»). The banner's own field and colours, but
 * **one** WebGL context for every card: the field is drawn once a frame, small, and each card
 * shows its own cut of it on a 2D canvas. A context per card would be a dozen shaders on a page of
 * twelve collections, and browsers drop contexts past a handful.
 *
 * Manners, as the banner's: nothing is created until a card is on screen; only cards on screen are
 * painted, and nothing runs while none is, or while the tab is hidden; «менше руху» — one still
 * frame; no WebGL — the card keeps the CSS gradient it has.
 */

/** The shared field's size: soft light, so every card scales its cut up. */
const FIELD = { width: 480, height: 300 }
/** The cards' light: even across the card — text stands anywhere on it — and dimmer than the banner's. */
const FRAGMENT = `${AURORA_FIELD}col=mix(ink,col,.7);
col+=(h(gl_FragCoord.xy+fract(u_time))-.5)*.02;
gl_FragColor=vec4(col,1.);}`

interface Card {
	canvas: HTMLCanvasElement
	context: CanvasRenderingContext2D
	/** 0…1: where this card's cut of the field lies, so two cards are not one picture. */
	shift: number
	visible: boolean
}

type Field = (seconds: number) => HTMLCanvasElement

const cards = new Set<Card>()
/** `undefined` — not tried yet; `null` — this browser has no WebGL, or lost the context. */
let field: Field | null | undefined
let frame = 0
let started = 0
/** «Менше руху»: every card is one still frame and no frame is ever scheduled. */
let still = false

function createField(): Field | null {
	const canvas = document.createElement('canvas')
	canvas.width = FIELD.width
	canvas.height = FIELD.height
	const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
	if (!gl) return null
	// A lost context draws nothing: the loop stops and the cards keep their last frame.
	canvas.addEventListener('webglcontextlost', () => {
		field = null
		cancelAnimationFrame(frame)
		frame = 0
	})
	const compile = (type: number, source: string) => {
		const shader = gl.createShader(type)!
		gl.shaderSource(shader, source)
		gl.compileShader(shader)
		return shader
	}
	const program = gl.createProgram()!
	gl.attachShader(program, compile(gl.VERTEX_SHADER, AURORA_VERTEX))
	gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
	gl.useProgram(program)
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
	const position = gl.getAttribLocation(program, 'p')
	gl.enableVertexAttribArray(position)
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
	gl.viewport(0, 0, FIELD.width, FIELD.height)
	gl.uniform2f(gl.getUniformLocation(program, 'u_res'), FIELD.width, FIELD.height)
	gl.uniform2f(gl.getUniformLocation(program, 'u_mouse'), 0.5, 0.5)
	const time = gl.getUniformLocation(program, 'u_time')
	return seconds => {
		gl.uniform1f(time, seconds)
		gl.drawArrays(gl.TRIANGLES, 0, 3)
		return canvas
	}
}

/**
 * The card's cut of the field: its own proportions, as large as the field allows, placed by
 * `shift`. Called in the frame the field was drawn in — the drawing buffer is not kept.
 */
export function cutOf(card: { width: number; height: number; shift: number }) {
	const ratio = card.width / card.height
	const width = Math.min(FIELD.width, FIELD.height * ratio)
	const height = width / ratio
	return {
		x: (FIELD.width - width) * card.shift,
		y: (FIELD.height - height) * (1 - card.shift),
		width,
		height
	}
}

function paint(card: Card, source: HTMLCanvasElement) {
	const { width, height } = card.canvas
	if (!width || !height) return
	const cut = cutOf({ width, height, shift: card.shift })
	card.context.drawImage(source, cut.x, cut.y, cut.width, cut.height, 0, 0, width, height)
	card.canvas.dataset.ready = 'true'
}

const seconds = (now: number) => (now - started) / 1000

function tick(now: number) {
	frame = 0
	if (!field) return
	const source = field(seconds(now))
	for (const card of cards) if (card.visible) paint(card, source)
	schedule()
}

function schedule() {
	if (still || frame || document.hidden) return
	for (const card of cards)
		if (card.visible) {
			frame = requestAnimationFrame(tick)
			return
		}
}

/**
 * Attach a card's 2D canvas to the shared field; the answer detaches it. Nothing happens — and the
 * canvas stays hidden over the card's CSS gradient — without a 2D context or WebGL.
 */
export function mountCardAurora(element: HTMLCanvasElement, shift: number): () => void {
	const context = element.getContext('2d')
	if (!context) return () => {}
	// Asked here and answered in `schedule`, the one place a frame is requested: the tab coming
	// back into view asks for one too, and used to start the loop under «менше руху».
	still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
	const card: Card = { canvas: element, context, shift, visible: false }
	const resize = () => {
		const box = element.getBoundingClientRect()
		// Half the pixels, as the banner: the light is soft.
		element.width = Math.max(1, Math.round(box.width * 0.5))
		element.height = Math.max(1, Math.round(box.height * 0.5))
	}
	const show = () => {
		// The context is made when the first card comes on screen, not on load.
		if (field === undefined) {
			field = createField()
			started = performance.now()
		}
		if (!field) return
		resize()
		// One frame now: a resized canvas is blank, and «менше руху» gets no other.
		paint(card, field(seconds(performance.now())))
		schedule()
	}
	// The latest entry: several delivered at once are a history, and the first is its oldest.
	const observer = new IntersectionObserver(entries => {
		card.visible = entries[entries.length - 1].isIntersecting
		if (card.visible) show()
	})
	const sizes = new ResizeObserver(() => {
		if (card.visible) show()
	})
	const onVisibility = () => schedule()
	cards.add(card)
	observer.observe(element)
	sizes.observe(element)
	document.addEventListener('visibilitychange', onVisibility)
	return () => {
		cards.delete(card)
		observer.disconnect()
		sizes.disconnect()
		document.removeEventListener('visibilitychange', onVisibility)
		if (cards.size === 0 && frame) {
			cancelAnimationFrame(frame)
			frame = 0
		}
	}
}

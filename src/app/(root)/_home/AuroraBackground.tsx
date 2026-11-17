'use client'

import { useEffect, useRef } from 'react'

/**
 * The home banner's background (TD-0015, owner 2026-11-09: «Аврора»): slow light under water in the
 * brand's colours, abstract — nothing about any product. Decoration only — the banner's text is
 * server HTML above it, so it is never the page's LCP and never shifts the layout.
 *
 * Cost and manners: one fragment shader, no library; drawn at half resolution (the field is soft);
 * started once the browser is idle; paused while the banner is off screen or the tab is hidden;
 * «менше руху» — one still frame; no WebGL — the CSS gradient behind the canvas stays.
 */
export const AURORA_VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
/**
 * The field and its colours, `main` left open: the banner closes it with its own light below, the
 * cards' renderer (`aurora-cards.ts`) with theirs — one «Аврора», not two that drift apart.
 *
 * High precision where the GPU has it: the hash multiplies by hundreds, and a 16-bit `mediump`
 * (most phone GPUs honour it) loses the noise's fine octaves and overflows on the upper rows.
 */
export const AURORA_FIELD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}
void main(){
vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv*vec2(u_res.x/u_res.y,1.)*1.5;float t=u_time*.035;
vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));
vec2 r=vec2(fbm(p+3.4*q+vec2(1.7,9.2)+t*1.3+(u_mouse-.5)*.6),fbm(p+3.4*q+vec2(8.3,2.8)-t));
float f=fbm(p+3.*r);
vec3 ink=vec3(.043,.071,.125),teal=vec3(.106,.722,.58),mint=vec3(.098,.902,.702),azure=vec3(.094,.565,.859);
vec3 col=mix(ink,teal*.5,smoothstep(.28,.78,f));
col=mix(col,azure*.75,smoothstep(.4,1.,length(q))*.55);
col=mix(col,mint,smoothstep(.6,.95,f)*.6*r.x);
`
const VERTEX = AURORA_VERTEX
// The banner's light: darker under the text on the left, a soft vignette, a little grain.
const FRAGMENT = `${AURORA_FIELD}col*=mix(.45,1.,smoothstep(.05,.85,uv.x));
col*=.82+.18*smoothstep(1.2,.2,length(uv-vec2(.6,.55)));
col+=(h(gl_FragCoord.xy+fract(u_time))-.5)*.03;
gl_FragColor=vec4(col,1.);}`

export function AuroraBackground() {
	const canvas = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const element = canvas.current
		const gl = element?.getContext('webgl', { antialias: false, premultipliedAlpha: false })
		if (!element || !gl) return
		const compile = (type: number, source: string) => {
			const shader = gl.createShader(type)!
			gl.shaderSource(shader, source)
			gl.compileShader(shader)
			return shader
		}
		const program = gl.createProgram()!
		gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
		gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
		gl.linkProgram(program)
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
		gl.useProgram(program)
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
		const position = gl.getAttribLocation(program, 'p')
		gl.enableVertexAttribArray(position)
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
		const resolution = gl.getUniformLocation(program, 'u_res')
		const time = gl.getUniformLocation(program, 'u_time')
		const pointer = gl.getUniformLocation(program, 'u_mouse')

		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const target = { x: 0.5, y: 0.5 }
		const eased = { x: 0.5, y: 0.5 }
		const started = performance.now()
		let frame = 0
		let visible = true
		let ready = false

		const resize = () => {
			const { width, height } = element.getBoundingClientRect()
			element.width = Math.max(1, Math.round(width * 0.5))
			element.height = Math.max(1, Math.round(height * 0.5))
			gl.viewport(0, 0, element.width, element.height)
		}
		const draw = (now: number) => {
			eased.x += (target.x - eased.x) * 0.03
			eased.y += (target.y - eased.y) * 0.03
			gl.uniform2f(resolution, element.width, element.height)
			gl.uniform1f(time, (now - started) / 1000)
			gl.uniform2f(pointer, eased.x, eased.y)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
		}
		const loop = (now: number) => {
			frame = 0
			draw(now)
			schedule()
		}
		const schedule = () => {
			if (!frame && ready && visible && !still && !document.hidden)
				frame = requestAnimationFrame(loop)
		}
		const begin = () => {
			resize()
			ready = true
			element.dataset.ready = 'true'
			if (still) draw(started)
			else schedule()
		}
		const onMove = (event: PointerEvent) => {
			const box = element.getBoundingClientRect()
			target.x = (event.clientX - box.left) / box.width
			target.y = 1 - (event.clientY - box.top) / box.height
		}
		const onVisibility = () => schedule()
		// A lost context draws nothing: the loop stops and the banner is its CSS gradient again.
		const onLost = () => {
			ready = false
			cancelAnimationFrame(frame)
			frame = 0
			delete element.dataset.ready
		}
		// The latest entry: several delivered at once are a history, and the first is its oldest.
		const observer = new IntersectionObserver(entries => {
			visible = entries[entries.length - 1].isIntersecting
			schedule()
		})
		const sizes = new ResizeObserver(() => {
			if (!ready) return
			resize()
			if (still) draw(performance.now())
		})
		observer.observe(element)
		sizes.observe(element)
		element.parentElement?.addEventListener('pointermove', onMove)
		element.addEventListener('webglcontextlost', onLost)
		document.addEventListener('visibilitychange', onVisibility)
		// After the page's own work: the banner's text is already painted by then.
		const hasIdle = typeof window.requestIdleCallback === 'function'
		const idle = hasIdle
			? window.requestIdleCallback(begin, { timeout: 1500 })
			: window.setTimeout(begin, 300)

		return () => {
			if (hasIdle) window.cancelIdleCallback(idle)
			else window.clearTimeout(idle)
			cancelAnimationFrame(frame)
			observer.disconnect()
			sizes.disconnect()
			element.parentElement?.removeEventListener('pointermove', onMove)
			element.removeEventListener('webglcontextlost', onLost)
			document.removeEventListener('visibilitychange', onVisibility)
			// The context goes with the canvas: a browser keeps a handful and drops the oldest past
			// that — left to the garbage collector on every visit to the page, these cost the cards'
			// shared context (`aurora-cards.ts`) its place. A tick later, and only when the canvas is
			// gone: in development React runs this cleanup and the effect again on the same canvas.
			window.setTimeout(() => {
				if (!element.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext()
			})
		}
	}, [])

	return (
		<canvas
			ref={canvas}
			aria-hidden
			className='pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100'
		/>
	)
}

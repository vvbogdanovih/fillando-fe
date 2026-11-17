'use client'

import { useEffect, useRef } from 'react'
import { mountCardAurora } from './aurora-cards'

/**
 * The live background of a dark home page card (see `aurora-cards.ts`): a decorative canvas under
 * the card's content, shown once a frame is on it. The card must be `relative isolate
 * overflow-hidden` and keep its CSS gradient — that is what shows before the first frame, without
 * WebGL and to a crawler.
 */
export function CardAurora({ shift = 0.5 }: { shift?: number }) {
	const canvas = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		if (canvas.current) return mountCardAurora(canvas.current, shift)
	}, [shift])
	return (
		<canvas
			ref={canvas}
			aria-hidden
			className='pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100'
		/>
	)
}

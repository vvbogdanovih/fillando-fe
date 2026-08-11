'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'

interface ParallaxProps {
	children: ReactNode
	/** Fraction of the element's scroll travel to translate on Y (e.g. 0.2 = 20%).
	 *  Negative moves the layer against the scroll direction. */
	speed?: number
	className?: string
}

/**
 * Element-relative vertical parallax. Transform-only (compositor-friendly) —
 * use ONLY on decorative layers (gradient blobs, SVG, the glyph), never on large
 * rasters. Reduced-motion renders a static wrapper.
 */
export function Parallax({ children, speed = 0.2, className }: ParallaxProps) {
	const ref = useRef<HTMLDivElement>(null)
	const reduce = useReducedMotion()
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ['start end', 'end start']
	})
	const y = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 100}%`])

	if (reduce) {
		return (
			<div ref={ref} className={className}>
				{children}
			</div>
		)
	}

	return (
		<motion.div ref={ref} style={{ y, willChange: 'transform' }} className={className}>
			{children}
		</motion.div>
	)
}

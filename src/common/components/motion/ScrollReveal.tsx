'use client'

import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

const OFFSET: Record<Direction, { x?: number; y?: number }> = {
	up: { y: 24 },
	down: { y: -24 },
	left: { x: 24 },
	right: { x: -24 },
	none: {}
}

interface ScrollRevealProps {
	children: ReactNode
	direction?: Direction
	delay?: number
	amount?: number
	className?: string
}

/** Fade + directional slide once the element scrolls into view. Reduced-motion
 *  keeps a gentle opacity fade with no positional shift. */
export function ScrollReveal({
	children,
	direction = 'up',
	delay = 0,
	amount = 0.3,
	className
}: ScrollRevealProps) {
	const reduce = useReducedMotion()
	const from = reduce ? {} : OFFSET[direction]

	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, ...from }}
			whileInView={{ opacity: 1, x: 0, y: 0 }}
			viewport={{ once: true, amount }}
			transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
		>
			{children}
		</motion.div>
	)
}

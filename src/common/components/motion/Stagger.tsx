'use client'

import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

interface StaggerGroupProps {
	children: ReactNode
	className?: string
	stagger?: number
	amount?: number
}

/** Parent that orchestrates its `StaggerItem` children into view in sequence. */
export function StaggerGroup({
	children,
	className,
	stagger = 0.08,
	amount = 0.2
}: StaggerGroupProps) {
	return (
		<motion.div
			className={className}
			initial='hidden'
			whileInView='show'
			viewport={{ once: true, amount }}
			variants={{ show: { transition: { staggerChildren: stagger } } }}
		>
			{children}
		</motion.div>
	)
}

interface StaggerItemProps {
	children: ReactNode
	className?: string
}

export function StaggerItem({ children, className }: StaggerItemProps) {
	const reduce = useReducedMotion()

	return (
		<motion.div
			className={className}
			variants={{
				hidden: { opacity: 0, y: reduce ? 0 : 20 },
				show: { opacity: 1, y: 0 }
			}}
			transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
		>
			{children}
		</motion.div>
	)
}

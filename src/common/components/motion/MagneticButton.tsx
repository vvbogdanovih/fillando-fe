'use client'

import { useRef, type ReactNode, type PointerEvent } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react'

interface MagneticButtonProps {
	children: ReactNode
	/** How strongly the content follows the cursor (0–1). */
	strength?: number
	className?: string
}

/**
 * Wrapper that makes its child (Button, Link, …) drift toward the cursor on
 * hover. Mouse-only (`pointerType === 'mouse'`) and disabled under reduced
 * motion, where it renders a plain inline wrapper. Keeps the child's own
 * semantics — it does not become a button itself.
 */
export function MagneticButton({ children, strength = 0.3, className }: MagneticButtonProps) {
	const ref = useRef<HTMLSpanElement>(null)
	const reduce = useReducedMotion()
	const mx = useMotionValue(0)
	const my = useMotionValue(0)
	const x = useSpring(mx, { stiffness: 200, damping: 15 })
	const y = useSpring(my, { stiffness: 200, damping: 15 })

	if (reduce) return <span className={className}>{children}</span>

	const handleMove = (e: PointerEvent<HTMLSpanElement>) => {
		if (e.pointerType !== 'mouse') return
		const el = ref.current
		if (!el) return
		const rect = el.getBoundingClientRect()
		mx.set((e.clientX - (rect.left + rect.width / 2)) * strength)
		my.set((e.clientY - (rect.top + rect.height / 2)) * strength)
	}

	const reset = () => {
		mx.set(0)
		my.set(0)
	}

	return (
		<motion.span
			ref={ref}
			style={{ x, y, display: 'inline-block' }}
			onPointerMove={handleMove}
			onPointerLeave={reset}
			className={className}
		>
			{children}
		</motion.span>
	)
}

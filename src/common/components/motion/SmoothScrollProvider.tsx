'use client'

import { type PropsWithChildren } from 'react'
import { ReactLenis } from 'lenis/react'
import { MotionConfig, useReducedMotion } from 'motion/react'

/**
 * Storefront-only smooth scroll + global motion config.
 *
 * Mounted in `(root)/layout.tsx` so admin/auth keep native scroll. Under
 * reduced-motion we skip Lenis entirely (native OS scroll) — `useLenis()` then
 * returns undefined and `useLenisModalLock` no-ops, while Radix keeps handling
 * modal scroll-locking on its own.
 */
export function SmoothScrollProvider({ children }: PropsWithChildren) {
	const reduce = useReducedMotion()

	if (reduce) return <MotionConfig reducedMotion='user'>{children}</MotionConfig>

	return (
		<MotionConfig reducedMotion='user'>
			<ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
				{children}
			</ReactLenis>
		</MotionConfig>
	)
}

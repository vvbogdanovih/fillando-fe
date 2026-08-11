'use client'

import { type PropsWithChildren, useSyncExternalStore } from 'react'
import { ReactLenis } from 'lenis/react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
	const mq = window.matchMedia(QUERY)
	mq.addEventListener('change', onChange)
	return () => mq.removeEventListener('change', onChange)
}

/**
 * Local reduced-motion read, deliberately not `useReducedMotion` from motion/react:
 * this provider wraps every storefront page, and importing from motion/react here
 * would pull the animation runtime into the shared layout chunk. `useSyncExternalStore`
 * (rather than a bare matchMedia read) keeps the server snapshot at `false` so the
 * root of the tree cannot hydration-mismatch.
 */
function usePrefersReducedMotion() {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(QUERY).matches,
		() => false
	)
}

/**
 * Storefront-only smooth scroll.
 *
 * Mounted in `(root)/layout.tsx` so admin/auth keep native scroll. Under
 * reduced-motion we skip Lenis entirely (native OS scroll) — `useLenis()` then
 * returns undefined and `useLenisModalLock` no-ops, while Radix keeps handling
 * modal scroll-locking on its own.
 *
 * NOTE: import this by its deep path, never via `components/motion`. That barrel
 * re-exports ScrollReveal/Stagger/Parallax/MagneticButton, which would drag
 * motion/react into the layout chunk on every storefront page. There is no
 * `<MotionConfig reducedMotion='user'>` here on purpose: every consumer already
 * calls `useReducedMotion()` and branches on it.
 */
export function SmoothScrollProvider({ children }: PropsWithChildren) {
	const reduce = usePrefersReducedMotion()

	if (reduce) return <>{children}</>

	return (
		<ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
			{children}
		</ReactLenis>
	)
}

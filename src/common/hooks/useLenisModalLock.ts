'use client'

import { useEffect } from 'react'
import { useLenis } from 'lenis/react'

/**
 * Pause Lenis smooth-scroll while a scroll-locking modal (Radix Dialog / drawer)
 * is open, so the background doesn't creep under the RAF loop. Safe when Lenis is
 * absent (reduced-motion path) — `useLenis()` returns undefined and we no-op.
 */
export function useLenisModalLock(active: boolean) {
	const lenis = useLenis()

	useEffect(() => {
		if (!lenis) return
		if (active) lenis.stop()
		else lenis.start()
		return () => lenis.start()
	}, [active, lenis])
}

'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/common/utils/shad-cn.utils'

/** Not shown at all for navigations that finish faster than this (cached pages, prefetched RSC). */
const SHOW_AFTER_MS = 120
/** A navigation that never changes the URL (a link whose click handler cancelled it) stops here. */
const GIVE_UP_AFTER_MS = 10_000
const FADE_MS = 300

const starters = new Set<() => void>()

/**
 * Call right before a programmatic `router.push`/`replace` that loads another page (filters,
 * search) with the same href. Link clicks are detected on their own. A push to the current URL
 * loads nothing and starts nothing.
 */
export function startNavigationProgress(href?: string) {
	if (href !== undefined && typeof window !== 'undefined') {
		const url = new URL(href, window.location.href)
		if (url.pathname === window.location.pathname && url.search === window.location.search)
			return
	}
	for (const start of starters) start()
}

/**
 * The URL a plain left click on an internal link will client-navigate to, or null: a new tab,
 * a download, another origin, the same page or an in-page anchor never start the bar.
 */
export function navigationTarget(
	event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'target'>,
	location: Pick<Location, 'href' | 'origin' | 'pathname' | 'search'>
): string | null {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return null
	const anchor = (event.target as Element | null)?.closest?.('a[href]')
	if (!(anchor instanceof HTMLAnchorElement)) return null
	if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null
	const url = new URL(anchor.getAttribute('href') ?? '', location.href)
	if (url.origin !== location.origin) return null
	if (url.pathname === location.pathname && url.search === location.search) return null
	return url.pathname + url.search
}

/**
 * Thin top bar while a client navigation loads the next page (Plan-0010, owner decision
 * 2026-10-28). Listing and product routes have no `loading.tsx` — a Suspense boundary there made
 * the production build stream a 200 before `notFound()`/`permanentRedirect()` (soft-404s) — so
 * without feedback the layout showed an empty `<main>` until the RSC payload arrived. The bar
 * wraps no page content: statuses stay real 404/308. It completes when the path or query changes.
 */
export function NavigationProgress() {
	const pathname = usePathname()
	const search = useSearchParams().toString()
	const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
	const timers = useRef<{ show?: number; giveUp?: number; fade?: number }>({})
	const shown = useRef(false)
	const finishRef = useRef<() => void>(() => {})

	useEffect(() => {
		const clear = () => {
			window.clearTimeout(timers.current.show)
			window.clearTimeout(timers.current.giveUp)
			window.clearTimeout(timers.current.fade)
		}
		const finish = () => {
			clear()
			if (!shown.current) return
			shown.current = false
			setState('done')
			timers.current.fade = window.setTimeout(() => setState('idle'), FADE_MS)
		}
		const start = () => {
			clear()
			timers.current.show = window.setTimeout(() => {
				shown.current = true
				setState('loading')
			}, SHOW_AFTER_MS)
			timers.current.giveUp = window.setTimeout(finish, GIVE_UP_AFTER_MS)
		}
		const onClick = (event: MouseEvent) => {
			if (navigationTarget(event, window.location)) start()
		}
		finishRef.current = finish
		starters.add(start)
		// Capture: runs before the link's own handler, which cancels the native navigation.
		document.addEventListener('click', onClick, true)
		return () => {
			starters.delete(start)
			document.removeEventListener('click', onClick, true)
			clear()
		}
	}, [])

	// The new page is committed: its path or query is what the hooks now report.
	useEffect(() => {
		finishRef.current()
	}, [pathname, search])

	return (
		<div
			aria-hidden='true'
			data-state={state}
			className={cn(
				'bg-primary pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left',
				state === 'idle' && 'hidden',
				state === 'loading' && 'animate-nav-progress',
				state === 'done' &&
					'scale-x-100 opacity-0 transition-[transform,opacity] duration-300'
			)}
		/>
	)
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import type { NavLink } from '@/common/constants'
import { isNavLinkActive } from '@/common/utils/navigation.utils'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** First segments that are never a category: the catalogue root and the product pages. */
const NOT_CATEGORIES = new Set(['catalog', 'products'])
const trails = new Map<string, Promise<string[]>>()

const loadTrail = (slug: string): Promise<string[]> => {
	let trail = trails.get(slug)
	if (!trail) {
		trail = fetch(`/api/catalog-nav/trail?slug=${slug}`).then(async response => {
			if (response.status === 404) return []
			if (!response.ok) throw new Error(`catalog-nav trail ${response.status}`)
			return ((await response.json()) as { hrefs: string[] }).hrefs
		})
		trails.set(slug, trail)
		// A failed read is not remembered: the next page view asks again.
		trail.catch(() => trails.delete(slug))
	}
	return trail
}

const flatten = (links: readonly NavLink[]): NavLink[] =>
	links.flatMap(link => [link, ...flatten(link.children ?? [])])

/**
 * Where the current page sits in a large catalogue whose header lists two levels only (P09,
 * owner decision 02.11.2026): the addresses from its root down to the page's category, read once
 * per category from the cached tree. Empty when the page is listed in the HTML anyway, is not a
 * category page, or the catalogue is small (the whole tree is in the HTML).
 */
export function useCatalogTrail(pathname: string, links: readonly NavLink[]): ReadonlySet<string> {
	const all = flatten(links)
	const large = all.some(link => link.lazy || link.more)
	const listed = all.some(link => isNavLinkActive(pathname, link.href))
	const slug = pathname.split('/')[1] ?? ''
	const wanted = large && !listed && SLUG.test(slug) && !NOT_CATEGORIES.has(slug)
	const [trail, setTrail] = useState<{ slug: string; hrefs: string[] }>({ slug: '', hrefs: [] })
	useEffect(() => {
		if (!wanted) return
		let current = true
		loadTrail(slug).then(
			hrefs => current && setTrail({ slug, hrefs }),
			() => undefined
		)
		return () => {
			current = false
		}
	}, [wanted, slug])
	return useMemo(
		() => new Set(wanted && trail.slug === slug ? trail.hrefs : []),
		[wanted, trail, slug]
	)
}

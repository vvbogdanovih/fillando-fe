'use client'

import { useEffect, useState } from 'react'
import type { NavLink } from '@/common/constants'

interface NavLevel {
	links: NavLink[]
	more: number
}
/** Loaded levels by category id, shared by the desktop panel and the mobile menu. */
const levels = new Map<string, Promise<NavLevel>>()

const loadLevel = (id: string): Promise<NavLevel> => {
	let level = levels.get(id)
	if (!level) {
		level = fetch(`/api/catalog-nav/${id}`).then(response => {
			if (!response.ok) throw new Error(`catalog-nav ${response.status}`)
			return response.json() as Promise<NavLevel>
		})
		levels.set(id, level)
		// A failed load is not remembered: opening the branch again retries.
		level.catch(() => levels.delete(id))
	}
	return level
}

/**
 * The sub-categories of a `lazy` navigation link (Plan-0010 D06.5), loaded once the branch is
 * opened (`open`). A link that is not lazy answers its own children; nothing is fetched for it.
 * After a failure nothing is fetched until `retry()` — the «Спробувати ще» button, or the menu
 * reopening the branch.
 */
export function useLazyNav(link: NavLink, open: boolean) {
	const [state, setState] = useState<{
		level: NavLevel | null
		failed: boolean
		attempt: number
	}>({ level: null, failed: false, attempt: 0 })
	useEffect(() => {
		if (!open || !link.lazy || !link.id || state.level || state.failed) return
		let current = true
		loadLevel(link.id).then(
			level => current && setState(value => ({ ...value, level, failed: false })),
			() => current && setState(value => ({ ...value, level: null, failed: true }))
		)
		return () => {
			current = false
		}
	}, [open, link.lazy, link.id, state.level, state.failed, state.attempt])
	const retry = () =>
		setState(value =>
			value.failed ? { level: null, failed: false, attempt: value.attempt + 1 } : value
		)
	if (!link.lazy)
		return {
			links: link.children ?? [],
			more: link.more ?? 0,
			loading: false,
			failed: false,
			retry
		}
	return {
		links: state.level?.links ?? [],
		more: state.level?.more ?? 0,
		loading: open && !state.level && !state.failed,
		failed: state.failed,
		retry
	}
}

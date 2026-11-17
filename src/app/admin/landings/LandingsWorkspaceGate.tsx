'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { categoryTreeApi } from '../categories/category-tree.api'

/**
 * After the catalogue migration the legacy landing writes are closed (interlock) and the typed
 * landings live with their category (Plan-0010 F07). Before it the legacy editor stays as it is.
 */
export function LandingsWorkspaceGate({ children }: { children: ReactNode }) {
	const capability = useQuery({
		queryKey: ['category-tree-capabilities'],
		queryFn: categoryTreeApi.capabilities,
		retry: false
	})
	// Only while the mode was never read: a later failed re-read keeps the screen already chosen.
	if (capability.isError && !capability.data)
		return (
			<p role='alert' className='p-4'>
				Не вдалося перевірити режим каталогу. Оновіть сторінку.
			</p>
		)
	if (!capability.data) return <p className='p-4'>Завантаження каталогу…</p>
	if (capability.data.legacy_writes_enabled) return <>{children}</>
	return (
		<div className='space-y-3 p-4'>
			<h1 className='text-xl font-semibold'>Посадкові сторінки</h1>
			<p>
				Каталог переведено на нову структуру: посадкові сторінки тепер редагуються разом зі
				своєю категорією — Категорії → товарна категорія → «Посадкові сторінки» (тексти,
				FAQ, закріплені фільтри, статус).
			</p>
			<Link href='/admin/categories' className='underline'>
				До категорій
			</Link>
		</div>
	)
}

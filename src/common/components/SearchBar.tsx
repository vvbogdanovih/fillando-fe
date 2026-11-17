'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { UI_URLS } from '@/common/constants'
import { cn } from '@/common/utils/shad-cn.utils'
import { startNavigationProgress } from './NavigationProgress'

/**
 * The header's search (TD-0015): a wide field with «Знайти», as a marketplace's — the main way in.
 * `className` sizes it: wide on a computer, the whole row on a phone.
 */
export function SearchBar({ className }: { className?: string } = {}) {
	const [query, setQuery] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const submit = () => {
		const trimmed = query.trim()
		if (trimmed.length < 2) return
		startNavigationProgress(`${UI_URLS.SEARCH}?q=${encodeURIComponent(trimmed)}`)
		router.push(`${UI_URLS.SEARCH}?q=${encodeURIComponent(trimmed)}`)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') submit()
	}

	const clear = () => {
		setQuery('')
		inputRef.current?.focus()
	}

	return (
		<div
			className={cn(
				'border-primary bg-card flex h-12 w-full items-center overflow-hidden rounded-xl border-2',
				className
			)}
		>
			<Search className='text-muted-foreground ml-3 h-4 w-4 shrink-0' aria-hidden />
			<input
				ref={inputRef}
				type='search'
				value={query}
				onChange={e => setQuery(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder='Я шукаю…'
				aria-label='Пошук товарів'
				className='placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none [&::-webkit-search-cancel-button]:hidden'
			/>
			{query && (
				<button
					onClick={clear}
					className='text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center transition-colors'
					aria-label='Очистити пошук'
				>
					<X className='h-3.5 w-3.5' />
				</button>
			)}
			<button
				onClick={submit}
				className='bg-primary text-primary-foreground h-full shrink-0 px-5 text-sm font-semibold transition hover:brightness-105'
			>
				Знайти
			</button>
		</div>
	)
}

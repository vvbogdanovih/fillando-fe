'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { UI_URLS } from '@/common/constants'
import { cn } from '@/common/utils/shad-cn.utils'

export function DesktopSearchBar() {
	const [query, setQuery] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const submit = () => {
		const trimmed = query.trim()
		if (trimmed.length < 2) return
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
		<div className='relative w-full max-w-sm'>
			<Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
			<input
				ref={inputRef}
				type='text'
				value={query}
				onChange={e => setQuery(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder='Пошук товарів...'
				className={cn(
					'border-border/50 bg-card placeholder:text-muted-foreground h-9 w-full rounded-xl border py-2 pl-9 text-sm shadow-sm transition-colors',
					query ? 'pr-16' : 'pr-9',
					'focus:border-primary focus:ring-primary/20 focus:ring-2 focus:outline-none'
				)}
			/>
			{query && (
				<button
					onClick={clear}
					className='text-muted-foreground hover:text-foreground absolute top-1/2 right-9 -translate-y-1/2 transition-colors'
					aria-label='Очистити пошук'
				>
					<X className='h-3.5 w-3.5' />
				</button>
			)}
			<button
				onClick={submit}
				className='text-muted-foreground hover:text-primary absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors'
				aria-label='Пошук'
			>
				<Search className='h-4 w-4' />
			</button>
		</div>
	)
}

export function MobileSearchToggle() {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const submit = useCallback(() => {
		const trimmed = query.trim()
		if (trimmed.length < 2) return
		router.push(`${UI_URLS.SEARCH}?q=${encodeURIComponent(trimmed)}`)
		setOpen(false)
	}, [query, router])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') submit()
	}

	const clear = () => {
		setQuery('')
		inputRef.current?.focus()
	}

	return (
		<>
			<button
				onClick={() => {
					setOpen(true)
					setTimeout(() => inputRef.current?.focus(), 100)
				}}
				aria-label='Пошук'
				className='border-border/50 bg-card hover:border-primary hover:text-primary flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors md:hidden'
			>
				<Search className='h-4 w-4' />
			</button>

			{open && (
				<div className='fixed inset-0 z-[60] md:hidden'>
					<div className='absolute inset-0 bg-black/60' onClick={() => setOpen(false)} />
					<div className='bg-background border-border/50 relative flex items-center gap-2 border-b px-4 py-3'>
						<Search className='text-muted-foreground h-4 w-4 shrink-0' />
						<input
							ref={inputRef}
							type='text'
							value={query}
							onChange={e => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder='Пошук товарів...'
							className='flex-1 bg-transparent text-sm outline-none'
							autoFocus
						/>
						{query && (
							<button
								onClick={clear}
								className='text-muted-foreground hover:text-foreground transition-colors'
								aria-label='Очистити'
							>
								<X className='h-4 w-4' />
							</button>
						)}
						<button
							onClick={submit}
							className='text-primary hover:text-primary/80 transition-colors'
							aria-label='Шукати'
						>
							<Search className='h-4 w-4' />
						</button>
						<button
							onClick={() => setOpen(false)}
							className='text-muted-foreground hover:text-foreground text-sm font-medium transition-colors'
						>
							Закрити
						</button>
					</div>
				</div>
			)}
		</>
	)
}

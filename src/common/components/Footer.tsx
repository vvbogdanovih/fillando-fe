import Image from 'next/image'
import Link from 'next/link'
import { UI_URLS } from '@/common/constants'

export function Footer() {
	return (
		<footer className='border-border bg-background border-t'>
			<div className='container mx-auto max-w-7xl px-4 py-10'>
				<div className='flex flex-col items-start justify-between gap-8 md:flex-row md:items-center'>
					{/* Logo */}
					<Link
						href={UI_URLS.HOME}
						className='flex items-center gap-2 transition-opacity hover:opacity-80'
					>
						<Image src='/Fillando.png' alt='Fillando' width={108} height={36} className='h-9 w-auto' />
						<span className='gradient-text text-3xl font-bold leading-none'>Fillando</span>
					</Link>

					{/* Nav */}
					<nav className='flex flex-wrap gap-x-8 gap-y-2'>
						<Link
							href={UI_URLS.HOME}
							className='text-muted-foreground hover:text-primary text-sm transition-colors'
						>
							Головна
						</Link>
						<Link
							href={UI_URLS.CATALOG.FILAMENT}
							className='text-muted-foreground hover:text-primary text-sm transition-colors'
						>
							Філамент
						</Link>
					</nav>
				</div>

				<div className='border-border mt-8 border-t pt-6'>
					<p className='text-muted-foreground text-xs'>
						© {new Date().getFullYear()} Fillando. Всі права захищені.
					</p>
				</div>
			</div>
		</footer>
	)
}

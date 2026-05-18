import Image from 'next/image'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { UI_URLS } from '@/common/constants'

const PHONE = '+380986050187'
const PHONE_DISPLAY = '+38 098 605 01 87'

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
						<Image src='/Fillando-120.png' alt='Fillando' width={108} height={36} className='h-9 w-auto' />
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

					{/* Contacts */}
					<div className='flex flex-col gap-2'>
						<div className='flex items-center gap-3'>
							<a
								href={`tel:${PHONE}`}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
							>
								<Phone className='size-4' />
								{PHONE_DISPLAY}
							</a>
						</div>
						<div className='flex items-center gap-3'>
							<a
								href={`viber://chat?number=${PHONE}`}
								className='text-muted-foreground hover:text-primary text-sm transition-colors'
								target='_blank'
								rel='noopener noreferrer'
							>
								Viber
							</a>
							<span className='text-muted-foreground/40'>|</span>
							<a
								href='https://t.me/fillando'
								className='text-muted-foreground hover:text-primary text-sm transition-colors'
								target='_blank'
								rel='noopener noreferrer'
							>
								Telegram
							</a>
						</div>
					</div>
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

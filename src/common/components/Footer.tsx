import Image from 'next/image'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { CONTACTS, UI_URLS } from '@/common/constants'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'

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
						<Image
							src='/Fillando-120.webp'
							alt=''
							width={108}
							height={36}
							className='h-9 w-auto'
						/>
						<span className='gradient-text text-3xl leading-none font-bold'>
							Fillando
						</span>
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
						<Link
							href={UI_URLS.WHOLESALE}
							className='text-muted-foreground hover:text-primary text-sm transition-colors'
						>
							Співпраця
						</Link>
						<Link
							href={UI_URLS.FAQ}
							className='text-muted-foreground hover:text-primary text-sm transition-colors'
						>
							FAQ
						</Link>
					</nav>

					{/* Contacts */}
					<div className='flex flex-col gap-2'>
						<div className='flex items-center gap-3'>
							<a
								href={`tel:${CONTACTS.PHONE}`}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
							>
								<Phone className='size-4' />
								{CONTACTS.PHONE_DISPLAY}
							</a>
						</div>
						<div className='flex items-center gap-3'>
							<a
								href={CONTACTS.VIBER_URL}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
								target='_blank'
								rel='noopener noreferrer'
							>
								<ViberIcon className='size-4' />
								Viber
							</a>
							<span className='text-muted-foreground/40'>|</span>
							<a
								href={CONTACTS.TELEGRAM_URL}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
								target='_blank'
								rel='noopener noreferrer'
							>
								<TelegramIcon className='size-4' />
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

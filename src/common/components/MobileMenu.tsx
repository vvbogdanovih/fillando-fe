'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Phone } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { CONTACTS, NAV_LINKS } from '@/common/constants'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'
import { useLenisModalLock } from '@/common/hooks/useLenisModalLock'
import { cn } from '@/common/utils/shad-cn.utils'

export function MobileMenu() {
	const [open, setOpen] = useState(false)

	// Pause Lenis while the menu is open so the background doesn't creep.
	useLenisModalLock(open)

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger asChild>
				<button
					aria-label='Меню'
					className='border-border/50 bg-card hover:border-primary hover:text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors md:hidden'
				>
					<Menu className='h-4 w-4' />
				</button>
			</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 duration-300' />
				<Dialog.Content
					aria-describedby={undefined}
					data-lenis-prevent
					className={cn(
						'bg-background fixed top-0 left-0 z-50 flex h-full w-full max-w-xs flex-col shadow-2xl outline-none',
						'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
						'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
					)}
				>
					<div className='border-border flex items-center justify-between border-b px-4 py-3'>
						<Dialog.Title className='gradient-text text-2xl leading-none font-bold'>
							Fillando
						</Dialog.Title>
						<Dialog.Close className='text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors'>
							<X className='h-4 w-4' />
							<span className='sr-only'>Закрити</span>
						</Dialog.Close>
					</div>

					<nav className='flex flex-col gap-1 p-3'>
						{NAV_LINKS.map(({ href, label }) => (
							<Dialog.Close key={href} asChild>
								<Link
									href={href}
									className='hover:bg-accent hover:text-primary rounded-lg px-3 py-2.5 font-medium transition-colors'
								>
									{label}
								</Link>
							</Dialog.Close>
						))}
					</nav>

					<div className='border-border mt-auto flex flex-col gap-4 border-t p-6'>
						<a
							href={`tel:${CONTACTS.PHONE}`}
							className='text-muted-foreground hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors'
						>
							<Phone className='size-4' />
							{CONTACTS.PHONE_DISPLAY}
						</a>
						<a
							href={CONTACTS.TELEGRAM_URL}
							target='_blank'
							rel='noopener noreferrer'
							className='text-muted-foreground hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors'
						>
							<TelegramIcon className='size-4' />
							Telegram
						</a>
						<a
							href={CONTACTS.VIBER_URL}
							target='_blank'
							rel='noopener noreferrer'
							className='text-muted-foreground hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors'
						>
							<ViberIcon className='size-4' />
							Viber
						</a>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

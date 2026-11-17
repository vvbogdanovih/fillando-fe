'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, X, Phone } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { CONTACTS, type NavLink } from '@/common/constants'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'
import { useLenisModalLock } from '@/common/hooks/useLenisModalLock'
import { isNavLinkActive } from '@/common/utils/navigation.utils'
import { cn } from '@/common/utils/shad-cn.utils'
import { useLazyNav } from '@/common/hooks/useLazyNav'
import { useCatalogTrail } from '@/common/hooks/useCatalogTrail'

export function MobileMenu({ navLinks }: { navLinks: NavLink[] }) {
	const [open, setOpen] = useState(false)
	const pathname = usePathname()
	// A large catalogue's deep page is not in the HTML: the branches above it are read (P09).
	const trail = useCatalogTrail(pathname, navLinks)

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

					<nav className='flex flex-col gap-1 overflow-y-auto p-3'>
						{navLinks.map(link => (
							<MobileNavItem
								key={link.href}
								link={link}
								pathname={pathname}
								trail={trail}
								depth={0}
							/>
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

/**
 * One link and, for a group, its sub-categories — recursively, so a tree of any depth is
 * reachable from a phone (TD-0013 F06). A branch starts open when the current page is inside it;
 * the indentation stops growing after a few levels instead of squeezing the labels away.
 */
function MobileNavItem({
	link,
	pathname,
	trail,
	depth
}: {
	link: NavLink
	pathname: string
	/** Addresses above the current page when the HTML does not list it (P09). */
	trail: ReadonlySet<string>
	depth: number
}) {
	const active = isNavLinkActive(pathname, link.href)
	const inside =
		(trail.has(link.href) && !active) ||
		(link.children ?? []).some(function contains(child): boolean {
			return isNavLinkActive(pathname, child.href) || (child.children ?? []).some(contains)
		})
	const [expanded, setExpanded] = useState(inside)
	// The trail of a deep page arrives after the first render: open the branch then.
	useEffect(() => {
		if (inside) setExpanded(true)
	}, [inside])
	// A large catalogue's branch (Plan-0010 D06.5) loads its sub-categories once opened.
	const level = useLazyNav(link, expanded)
	const children = level.links
	const expandable = children.length > 0 || Boolean(link.lazy)
	const listId = useId()
	return (
		<div>
			<div className='flex items-center gap-1'>
				<Dialog.Close asChild>
					<Link
						href={link.href}
						aria-current={active ? 'page' : undefined}
						className={cn(
							'flex-1 rounded-lg px-3 py-2.5 transition-colors',
							active
								? 'bg-accent text-foreground font-semibold'
								: 'hover:bg-accent hover:text-primary font-medium'
						)}
					>
						{link.label}
					</Link>
				</Dialog.Close>
				{expandable && (
					<button
						type='button'
						aria-expanded={expanded}
						aria-controls={expanded ? listId : undefined}
						aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'}: ${link.label}`}
						onClick={() => {
							setExpanded(value => !value)
							// Reopening a branch that failed to load tries again.
							level.retry()
						}}
						className='text-muted-foreground hover:bg-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors'
					>
						<ChevronDown
							className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
						/>
					</button>
				)}
			</div>
			{expandable && expanded && (
				<div
					id={listId}
					aria-busy={level.loading}
					className={cn('flex flex-col gap-1 border-l', depth < 4 ? 'ml-3 pl-2' : 'pl-1')}
				>
					{level.loading && (
						<p role='status' className='text-muted-foreground px-3 py-2 text-sm'>
							Завантаження…
						</p>
					)}
					{level.failed && (
						<p role='alert' className='text-muted-foreground px-3 py-2 text-sm'>
							Не вдалося завантажити.{' '}
							<button
								type='button'
								onClick={level.retry}
								className='text-primary underline underline-offset-2'
							>
								Спробувати ще
							</button>
						</p>
					)}
					{children.map(child => (
						<MobileNavItem
							key={child.href}
							link={child}
							pathname={pathname}
							trail={trail}
							depth={depth + 1}
						/>
					))}
					{level.more > 0 && (
						<Dialog.Close asChild>
							<Link
								href={link.href}
								className='text-primary rounded-lg px-3 py-2 text-sm hover:underline'
							>
								Усі ({level.more}) →
							</Link>
						</Dialog.Close>
					)}
				</div>
			)}
		</div>
	)
}

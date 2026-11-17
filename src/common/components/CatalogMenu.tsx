'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { CATALOG_NAV_LINK, type NavLink } from '@/common/constants'
import { isNavLinkActive } from '@/common/utils/navigation.utils'
import { cn } from '@/common/utils/shad-cn.utils'
import { useLazyNav } from '@/common/hooks/useLazyNav'
import { useCatalogTrail } from '@/common/hooks/useCatalogTrail'

/** How long the panel waits before closing, so the pointer can travel from the label into it. */
const CLOSE_DELAY_MS = 150

const flatten = (links: readonly NavLink[]): NavLink[] =>
	links.flatMap(link => [link, ...flatten(link.children ?? [])])

/**
 * «Каталог» in the desktop header with the whole category tree in a panel under the header,
 * instead of one header link per root category (the row overflowed and squeezed the search).
 *
 * The panel opens on mouse hover and on the chevron (a button: Enter/Space, and the tap on a touch
 * screen); keyboard focus never opens it, so Tab walks the header rather than every category
 * (owner decision 31.10.2026). Escape closes it and returns focus to the chevron. A touch's
 * emulated mouse events are ignored (pointer events filtered by type), so one tap opens it once.
 * The label stays a plain link to `/catalog`. The links are always rendered and only hidden
 * (`invisible`, out of the Tab order while closed): the tree has to be in the HTML a crawler
 * receives, which is why the layout fetches it on the server in the first place.
 */
export function CatalogMenu({ categories }: { categories: readonly NavLink[] }) {
	const pathname = usePathname()
	const panelId = useId()
	const [open, setOpen] = useState(false)
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const trigger = useRef<HTMLButtonElement>(null)

	const cancelClose = () => {
		if (closeTimer.current) clearTimeout(closeTimer.current)
		closeTimer.current = null
	}
	const show = () => {
		cancelClose()
		setOpen(true)
	}
	const hideSoon = () => {
		cancelClose()
		closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
	}
	const hide = () => {
		cancelClose()
		setOpen(false)
	}

	// A navigation through the panel (or anywhere else) closes it.
	useEffect(() => hide(), [pathname])
	useEffect(() => cancelClose, [])

	// A large catalogue's deep page is not in the HTML: where it sits is read (P09).
	const trail = useCatalogTrail(pathname, categories)
	const active =
		trail.size > 0 ||
		[CATALOG_NAV_LINK, ...flatten(categories)].some(link =>
			isNavLinkActive(pathname, link.href)
		)

	return (
		<div
			// Hover is a mouse's (or a pen's); a touch only taps the chevron.
			onPointerEnter={event => {
				if (event.pointerType !== 'touch') show()
			}}
			onPointerLeave={event => {
				if (event.pointerType !== 'touch') hideSoon()
			}}
			onBlur={(event: FocusEvent<HTMLDivElement>) => {
				if (!event.currentTarget.contains(event.relatedTarget)) hide()
			}}
			onKeyDown={event => {
				if (event.key === 'Escape' && open) {
					hide()
					if (event.target !== trigger.current) trigger.current?.focus()
				}
			}}
		>
			{/* A button in the marketplace header (TD-0015): the link and the chevron in one pill. */}
			<div
				className={cn(
					'flex h-12 items-center gap-0.5 rounded-xl px-3 transition-colors',
					active || open ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'
				)}
			>
				<Link
					href={CATALOG_NAV_LINK.href}
					aria-current={pathname === CATALOG_NAV_LINK.href ? 'page' : undefined}
					className={cn(
						'text-foreground text-sm whitespace-nowrap',
						active || open ? 'font-semibold' : 'font-medium'
					)}
				>
					{CATALOG_NAV_LINK.label}
				</Link>
				<button
					ref={trigger}
					type='button'
					aria-expanded={open}
					aria-controls={panelId}
					aria-label='Категорії каталогу'
					onClick={() => (open ? hide() : show())}
					className='text-muted-foreground hover:text-primary flex h-6 w-6 items-center justify-center rounded-md'
				>
					<ChevronDown
						className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
					/>
				</button>
			</div>

			<div
				id={panelId}
				className={cn(
					'border-border bg-background absolute inset-x-0 top-full border-b shadow-lg transition-[opacity,transform] duration-150',
					open
						? 'visible translate-y-0 opacity-100'
						: 'pointer-events-none invisible -translate-y-1 opacity-0'
				)}
			>
				<div className='container mx-auto max-w-7xl px-4 py-6'>
					<div className='grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-x-8 gap-y-6'>
						{categories.map(link => (
							<div key={link.href} className='min-w-0'>
								<Link
									href={link.href}
									onClick={hide}
									aria-current={
										isNavLinkActive(pathname, link.href) ? 'page' : undefined
									}
									className='hover:text-primary text-foreground text-sm font-semibold break-words transition-colors'
								>
									{link.label}
								</Link>
								{link.children && (
									<SubLinks
										links={link.children}
										pathname={pathname}
										onNavigate={hide}
									/>
								)}
								{link.more ? (
									<AllLink link={link} more={link.more} onNavigate={hide} />
								) : null}
							</div>
						))}
					</div>
					<div className='border-border mt-6 border-t pt-4'>
						<Link
							href={CATALOG_NAV_LINK.href}
							onClick={hide}
							className='text-primary text-sm font-medium hover:underline'
						>
							Увесь каталог →
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}

/** «Усі (N) →» under a branch whose sub-categories were not all listed (Plan-0010 D06.5). */
function AllLink({
	link,
	more,
	onNavigate
}: {
	link: NavLink
	more: number
	onNavigate: () => void
}) {
	return (
		<Link
			href={link.href}
			onClick={onNavigate}
			className='text-primary mt-1.5 inline-block text-sm hover:underline'
		>
			Усі ({more}) →
		</Link>
	)
}

/**
 * A large catalogue's branch the page does not carry (Plan-0010 D06.5): the link itself, and its
 * sub-categories once opened.
 */
function LazyBranch({
	link,
	pathname,
	onNavigate,
	depth
}: {
	link: NavLink
	pathname: string
	onNavigate: () => void
	depth: number
}) {
	const [open, setOpen] = useState(false)
	const level = useLazyNav(link, open)
	const listId = useId()
	return (
		<>
			<button
				type='button'
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-label={`${open ? 'Згорнути' : 'Показати підкатегорії'}: ${link.label}`}
				onClick={() => {
					setOpen(value => !value)
					// Reopening a branch that failed to load tries again.
					level.retry()
				}}
				className='text-muted-foreground hover:text-primary ml-1 inline-flex h-5 w-5 items-center justify-center rounded align-middle'
			>
				<ChevronDown
					className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
				/>
			</button>
			{open && (
				<div id={listId} aria-busy={level.loading}>
					{level.loading ? (
						<p role='status' className='text-muted-foreground mt-1 text-xs'>
							Завантаження…
						</p>
					) : level.failed ? (
						<p role='alert' className='text-muted-foreground mt-1 text-xs'>
							Не вдалося завантажити.{' '}
							<button
								type='button'
								onClick={level.retry}
								className='text-primary underline underline-offset-2'
							>
								Спробувати ще
							</button>
						</p>
					) : (
						<>
							<SubLinks
								links={level.links}
								pathname={pathname}
								onNavigate={onNavigate}
								depth={depth + 1}
							/>
							{level.more ? (
								<AllLink link={link} more={level.more} onNavigate={onNavigate} />
							) : null}
						</>
					)}
				</div>
			)}
		</>
	)
}

/** Sub-categories at any depth; indentation stops growing after a few levels. */
function SubLinks({
	links,
	pathname,
	onNavigate,
	depth = 0
}: {
	links: readonly NavLink[]
	pathname: string
	onNavigate: () => void
	depth?: number
}) {
	return (
		<ul className={cn('mt-2 space-y-1.5', depth > 0 && depth < 3 && 'pl-3')}>
			{links.map(link => (
				<li key={link.href}>
					<Link
						href={link.href}
						onClick={onNavigate}
						aria-current={isNavLinkActive(pathname, link.href) ? 'page' : undefined}
						className={cn(
							'text-sm break-words transition-colors',
							isNavLinkActive(pathname, link.href)
								? 'text-foreground font-semibold'
								: 'text-muted-foreground hover:text-primary'
						)}
					>
						{link.label}
					</Link>
					{link.children && (
						<SubLinks
							links={link.children}
							pathname={pathname}
							onNavigate={onNavigate}
							depth={depth + 1}
						/>
					)}
					{link.lazy && (
						<LazyBranch
							link={link}
							pathname={pathname}
							onNavigate={onNavigate}
							depth={depth}
						/>
					)}
				</li>
			))}
		</ul>
	)
}

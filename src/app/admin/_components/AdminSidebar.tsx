'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
	KeyRound,
	LayoutDashboard,
	Users,
	Tag,
	Percent,
	Palette,
	FileText,
	LogOut,
	Store,
	Package,
	PackageSearch,
	ChevronDown,
	CreditCard,
	Landmark,
	Wallet,
	Banknote,
	Handshake,
	Truck,
	Rss,
	Menu,
	LayoutTemplate,
	SwatchBook,
	X
} from 'lucide-react'
import { useAuthStore } from '@/common/store/useAuthStore'
import { UI_URLS } from '@/common/constants'
import { Button } from '@/common/components/ui/button'

type NavItem = { label: string; href: string; icon: React.ElementType }

/**
 * Grouped by task, labels as the screens title themselves (owner, 2026-11-03). The groups are
 * told apart by a caption and spacing, not by rules — a line between every group made the
 * column striped. Catalogue is a plain group rather than an accordion: Products is a daily
 * screen and must not cost a click from Orders.
 */
const navSections: { title?: string; items: NavItem[] }[] = [
	{ items: [{ label: 'Огляд', href: UI_URLS.ADMIN.BASE, icon: LayoutDashboard }] },
	{
		title: 'Продажі',
		items: [
			{ label: 'Замовлення', href: UI_URLS.ADMIN.ORDERS, icon: PackageSearch },
			{ label: 'Оптові заявки', href: UI_URLS.ADMIN.WHOLESALE, icon: Handshake },
			{ label: 'Купони', href: UI_URLS.ADMIN.COUPONS, icon: Percent },
			{ label: 'Користувачі', href: UI_URLS.ADMIN.USERS, icon: Users }
		]
	},
	{
		title: 'Каталог',
		items: [
			{ label: 'Товари', href: UI_URLS.ADMIN.PRODUCTS, icon: Package },
			{ label: 'Категорії', href: UI_URLS.ADMIN.CATEGORIES, icon: Tag },
			{ label: 'Кольори', href: UI_URLS.ADMIN.COLORS, icon: Palette },
			{ label: 'Постачальники', href: UI_URLS.ADMIN.VENDORS, icon: Store },
			{ label: 'Лендінги', href: UI_URLS.ADMIN.LANDINGS, icon: FileText }
		]
	},
	{
		title: 'Вітрина й канали',
		items: [
			{ label: 'Вітрина', href: UI_URLS.ADMIN.STOREFRONT, icon: LayoutTemplate },
			{ label: 'Google Feed', href: UI_URLS.ADMIN.FEED, icon: Rss }
		]
	}
]

const paymentDetailsItems: NavItem[] = [
	{ label: 'IBAN', href: UI_URLS.ADMIN.PAYMENT_DETAILS_IBAN, icon: Landmark },
	{ label: 'LiqPay', href: UI_URLS.ADMIN.PAYMENT_DETAILS_LIQPAY, icon: Wallet },
	{ label: 'MonoPay', href: UI_URLS.ADMIN.PAYMENT_DETAILS_MONOPAY, icon: Wallet },
	{ label: 'Готівка', href: UI_URLS.ADMIN.PAYMENT_DETAILS_CASH, icon: Banknote },
	{ label: 'Накладний платіж', href: UI_URLS.ADMIN.PAYMENT_DETAILS_COD, icon: Truck }
]

/** Rendered after the «Способи оплати» accordion, which opens the settings group. */
const settingsItems: NavItem[] = [
	{ label: 'API-токени', href: UI_URLS.ADMIN.API_TOKENS, icon: KeyRound },
	{ label: 'Style Guide', href: UI_URLS.ADMIN.STYLE_GUIDE, icon: SwatchBook }
]

const itemClass = (isActive: boolean) =>
	`group relative mb-0.5 flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors ${
		isActive
			? 'bg-primary/10 font-medium text-primary-strong before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary-strong'
			: 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
	}`

const iconClass = (isActive: boolean) =>
	isActive ? 'text-primary-strong' : 'text-gray-400 group-hover:text-gray-600'

const SectionTitle = ({ id, children }: { id: string; children: string }) => (
	<p
		id={id}
		className='mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase'
	>
		{children}
	</p>
)

export const AdminSidebar = () => {
	const pathname = usePathname()
	const router = useRouter()
	const user = useAuthStore(state => state.getUser())
	const logOut = useAuthStore(state => state.logOut)
	const [mobileOpen, setMobileOpen] = useState(false)

	const isPaymentDetailsActive = paymentDetailsItems.some(item => pathname.startsWith(item.href))
	const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(isPaymentDetailsActive)

	const handleLogout = async () => {
		await logOut()
		router.push(UI_URLS.AUTH.LOGIN)
	}

	const navLink = ({ href, icon: Icon, label }: NavItem) => {
		const isActive = href === UI_URLS.ADMIN.BASE ? pathname === href : pathname.startsWith(href)
		return (
			<Link
				key={href}
				href={href}
				aria-current={isActive ? 'page' : undefined}
				onClick={() => setMobileOpen(false)}
				className={itemClass(isActive)}
			>
				<Icon size={16} className={iconClass(isActive)} />
				<span className='flex-1'>{label}</span>
			</Link>
		)
	}

	const paymentHighlighted = isPaymentDetailsActive && !paymentDetailsOpen

	const sidebarContent = (
		<>
			<Link
				href={UI_URLS.HOME}
				className='flex items-center gap-3 border-b border-gray-200 px-5 py-4'
			>
				<Image
					src='/Fillando.png'
					alt='Fillando'
					width={96}
					height={32}
					className='h-8 w-auto'
				/>
				<span className='text-base font-semibold text-gray-900'>Fillando Admin</span>
			</Link>

			<nav aria-label='Адмін-панель' className='flex-1 overflow-auto px-3 pt-3 pb-4'>
				{navSections.map(({ title, items }, index) => {
					const titleId = `admin-nav-${index}`
					return (
						<div
							key={titleId}
							role='group'
							aria-labelledby={title ? titleId : undefined}
						>
							{title && <SectionTitle id={titleId}>{title}</SectionTitle>}
							{items.map(navLink)}
						</div>
					)
				})}

				<div role='group' aria-labelledby='admin-nav-settings'>
					<SectionTitle id='admin-nav-settings'>Налаштування</SectionTitle>
					<button
						type='button'
						aria-expanded={paymentDetailsOpen}
						onClick={() => setPaymentDetailsOpen(o => !o)}
						className={itemClass(paymentHighlighted)}
					>
						<CreditCard size={16} className={iconClass(paymentHighlighted)} />
						<span className='flex-1 text-left'>Способи оплати</span>
						<ChevronDown
							size={14}
							className={`text-gray-400 transition-transform duration-200 ${paymentDetailsOpen ? 'rotate-180' : ''}`}
						/>
					</button>

					{paymentDetailsOpen && (
						<div className='mb-0.5 ml-4 border-l border-gray-200 pl-3'>
							{paymentDetailsItems.map(navLink)}
						</div>
					)}

					{settingsItems.map(navLink)}
				</div>
			</nav>

			<div className='flex items-center gap-2 border-t border-gray-200 px-4 py-3'>
				<div className='min-w-0 flex-1 px-1'>
					<p className='truncate text-sm font-medium text-gray-900'>{user?.name}</p>
					<p className='truncate text-xs text-gray-500'>{user?.email}</p>
				</div>
				<Button
					variant='ghost'
					size='icon-sm'
					onClick={handleLogout}
					title='Вийти'
					aria-label='Вийти'
					className='text-gray-500 hover:text-gray-900'
				>
					<LogOut size={16} />
				</Button>
			</div>
		</>
	)

	return (
		<>
			{/* Mobile header */}
			<div className='fixed top-0 right-0 left-0 z-40 flex items-center border-b border-gray-200 bg-white px-4 py-3 md:hidden'>
				<button type='button' onClick={() => setMobileOpen(true)}>
					<Menu size={24} className='text-gray-700' />
				</button>
				<span className='ml-3 text-sm font-semibold text-gray-900'>Fillando Admin</span>
			</div>

			{/* Mobile overlay */}
			{mobileOpen && (
				<div
					className='fixed inset-0 z-40 bg-black/40 md:hidden'
					onClick={() => setMobileOpen(false)}
				/>
			)}

			{/* Sidebar — desktop: static, mobile: slide-over */}
			<aside
				className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:static md:translate-x-0 ${
					mobileOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				{/* Mobile close button */}
				<button
					type='button'
					onClick={() => setMobileOpen(false)}
					className='absolute top-5 right-3 z-10 md:hidden'
				>
					<X size={20} className='text-gray-500' />
				</button>
				{sidebarContent}
			</aside>
		</>
	)
}

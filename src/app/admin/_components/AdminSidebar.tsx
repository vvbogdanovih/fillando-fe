'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
	LayoutDashboard,
	Users,
	Tag,
	Percent,
	Palette,
	LogOut,
	Store,
	Package,
	PackageSearch,
	ShoppingBag,
	ChevronDown,
	CreditCard,
	Landmark,
	Wallet,
	Banknote,
	Handshake,
	Menu,
	X
} from 'lucide-react'
import { useAuthStore } from '@/common/store/useAuthStore'
import { UI_URLS } from '@/common/constants'
import { Button } from '@/common/components/ui/button'

const topNavItems = [
	{ label: 'Dashboard', href: UI_URLS.ADMIN.BASE, icon: LayoutDashboard },
	{ label: 'Orders', href: UI_URLS.ADMIN.ORDERS, icon: PackageSearch },
	{ label: 'Wholesale', href: UI_URLS.ADMIN.WHOLESALE, icon: Handshake },
	{ label: 'Users', href: UI_URLS.ADMIN.USERS, icon: Users },
	{ label: 'Coupons', href: UI_URLS.ADMIN.COUPONS, icon: Percent }
]

const paymentDetailsItems = [
	{ label: 'IBAN', href: UI_URLS.ADMIN.PAYMENT_DETAILS_IBAN, icon: Landmark },
	{ label: 'LiqPay', href: UI_URLS.ADMIN.PAYMENT_DETAILS_LIQPAY, icon: Wallet },
	{ label: 'MonoPay', href: UI_URLS.ADMIN.PAYMENT_DETAILS_MONOPAY, icon: Wallet },
	{ label: 'Готівка', href: UI_URLS.ADMIN.PAYMENT_DETAILS_CASH, icon: Banknote }
]

const catalogueItems = [
	{ label: 'Products', href: UI_URLS.ADMIN.PRODUCTS, icon: Package },
	{ label: 'Categories', href: UI_URLS.ADMIN.CATEGORIES, icon: Tag },
	{ label: 'Vendors', href: UI_URLS.ADMIN.VENDORS, icon: Store }
]

const bottomNavItems = [{ label: 'Style Guide', href: UI_URLS.ADMIN.STYLE_GUIDE, icon: Palette }]

export const AdminSidebar = () => {
	const pathname = usePathname()
	const router = useRouter()
	const user = useAuthStore(state => state.getUser())
	const logOut = useAuthStore(state => state.logOut)
	const [mobileOpen, setMobileOpen] = useState(false)

	const isPaymentDetailsActive = paymentDetailsItems.some(item => pathname.startsWith(item.href))
	const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(isPaymentDetailsActive)

	const isCatalogueActive = catalogueItems.some(item => pathname.startsWith(item.href))
	const [catalogueOpen, setCatalogueOpen] = useState(isCatalogueActive)

	const handleLogout = async () => {
		await logOut()
		router.push(UI_URLS.AUTH.LOGIN)
	}

	const navLink = (href: string, icon: React.ElementType, label: string) => {
		const Icon = icon
		const isActive = href === UI_URLS.ADMIN.BASE ? pathname === href : pathname.startsWith(href)
		return (
			<Link
				key={href}
				href={href}
				onClick={() => setMobileOpen(false)}
				className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
					isActive
						? 'bg-gray-100 font-medium text-gray-900'
						: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
				}`}
			>
				<Icon size={16} />
				{label}
			</Link>
		)
	}

	const sidebarContent = (
		<>
			<Link href={UI_URLS.HOME} className='border-b border-gray-200 px-6 py-5'>
				<Image
					src='/Fillando.png'
					alt='Fillando'
					width={96}
					height={32}
					className='h-8 w-auto'
				/>
				<span className='text-lg font-semibold text-gray-900'>Fillando Admin</span>
			</Link>

			<nav className='flex-1 overflow-auto px-3 py-4'>
				{topNavItems.map(({ label, href, icon }) => navLink(href, icon, label))}

				{/* Payment details accordion */}
				<div className='mb-1'>
					<button
						type='button'
						onClick={() => setPaymentDetailsOpen(o => !o)}
						className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
							isPaymentDetailsActive && !paymentDetailsOpen
								? 'bg-gray-100 font-medium text-gray-900'
								: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
						}`}
					>
						<CreditCard size={16} />
						<span className='flex-1 text-left'>Payment details</span>
						<ChevronDown
							size={14}
							className={`transition-transform duration-200 ${paymentDetailsOpen ? 'rotate-180' : ''}`}
						/>
					</button>

					{paymentDetailsOpen && (
						<div className='mt-0.5 ml-4 border-l border-gray-200 pl-3'>
							{paymentDetailsItems.map(({ label, href, icon }) =>
								navLink(href, icon, label)
							)}
						</div>
					)}
				</div>

				{/* Catalogue accordion */}
				<div className='mb-1'>
					<button
						type='button'
						onClick={() => setCatalogueOpen(o => !o)}
						className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
							isCatalogueActive && !catalogueOpen
								? 'bg-gray-100 font-medium text-gray-900'
								: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
						}`}
					>
						<ShoppingBag size={16} />
						<span className='flex-1 text-left'>Catalogue</span>
						<ChevronDown
							size={14}
							className={`transition-transform duration-200 ${catalogueOpen ? 'rotate-180' : ''}`}
						/>
					</button>

					{catalogueOpen && (
						<div className='mt-0.5 ml-4 border-l border-gray-200 pl-3'>
							{catalogueItems.map(({ label, href, icon }) =>
								navLink(href, icon, label)
							)}
						</div>
					)}
				</div>

				{bottomNavItems.map(({ label, href, icon }) => navLink(href, icon, label))}
			</nav>

			<div className='border-t border-gray-200 px-4 py-4'>
				<div className='mb-3 px-1'>
					<p className='text-sm font-medium text-gray-900'>{user?.name}</p>
					<p className='text-xs text-gray-500'>{user?.email}</p>
				</div>
				<Button
					onClick={handleLogout}
					className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm'
				>
					<LogOut size={16} /> Logout
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
					className='absolute top-4 right-3 z-10 md:hidden'
				>
					<X size={20} className='text-gray-500' />
				</button>
				{sidebarContent}
			</aside>
		</>
	)
}

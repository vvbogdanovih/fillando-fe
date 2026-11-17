'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ShoppingCart, UserRound } from 'lucide-react'
import { SearchBar } from '@/common/components/SearchBar'
import { CATALOG_NAV_LINK, STATIC_NAV_LINKS, UI_URLS, type NavLink } from '@/common/constants'
import { CatalogMenu } from '@/common/components/CatalogMenu'
import { MobileMenu } from '@/common/components/MobileMenu'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { CartSidebar } from '@/common/components/CartSidebar'

/** «Кабінет» and «Кошик» as in the sketch (TD-0015): an icon over a short label. */
const ACTION =
	'hover:bg-muted relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors'

// `ssr: false` is safe here: `user` comes from a skipHydration Zustand store that
// only rehydrates after mount, so the server never renders this branch anyway.
const UserMenu = dynamic(() => import('@/common/components/UserMenu').then(m => m.UserMenu), {
	ssr: false
})

/**
 * The storefront header (TD-0015, a marketplace's): logo, «Каталог», a wide search with «Знайти»,
 * «Кабінет» and «Кошик». `categories` is the public category tree (`getCategoryNavLinks`): on a
 * computer it lives in the «Каталог» panel under the header, the mobile menu lists it nested. The
 * price sheet, wholesale, FAQ and contacts are in the footer and the mobile menu; on a phone the
 * search takes the header's second row.
 */
export function Header({ categories }: { categories: readonly NavLink[] }) {
	const navLinks: NavLink[] = [CATALOG_NAV_LINK, ...categories, ...STATIC_NAV_LINKS]
	const user = useAuthStore(s => s.user)
	const logOut = useAuthStore(s => s.logOut)
	const resetServerCart = useCartStore(s => s.resetServerCart)
	const openCart = useCartStore(s => s.openCart)
	const items = useCartStore(s => s.items)
	const guestItems = useCartStore(s => s.guestItems)
	const router = useRouter()

	const totalCount = user
		? items.reduce((sum, i) => sum + i.quantity, 0)
		: guestItems.reduce((sum, i) => sum + i.quantity, 0)

	const handleLogout = async () => {
		await logOut()
		resetServerCart()
		router.push(UI_URLS.AUTH.LOGIN)
	}

	return (
		<>
			<header className='border-border bg-background/90 sticky top-0 z-50 border-b backdrop-blur-lg'>
				<div className='container mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-5'>
					<MobileMenu navLinks={navLinks} />
					<Link
						href='/'
						className='flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80'
					>
						<Image
							src='/Fillando-120.webp'
							alt=''
							width={120}
							height={40}
							priority
							className='h-9 w-auto'
						/>
						<span className='font-display gradient-text hidden text-2xl leading-none font-bold sm:inline'>
							Fillando
						</span>
					</Link>

					<div className='hidden min-w-0 flex-1 items-center gap-3 md:flex'>
						<CatalogMenu categories={categories} />
						<SearchBar />
					</div>

					<div className='ml-auto flex shrink-0 items-center gap-1'>
						{!user ? (
							<Link href={UI_URLS.AUTH.LOGIN} className={ACTION}>
								<UserRound className='size-[22px]' aria-hidden />
								Кабінет
							</Link>
						) : (
							<UserMenu user={user} onLogout={handleLogout} className={ACTION} />
						)}
						<button
							type='button'
							onClick={openCart}
							aria-label='Кошик'
							className={ACTION}
						>
							<ShoppingCart className='size-[22px]' aria-hidden />
							Кошик
							{totalCount > 0 && (
								<span className='bg-primary text-primary-foreground pointer-events-none absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold'>
									{totalCount > 99 ? '99+' : totalCount}
								</span>
							)}
						</button>
					</div>
				</div>
				<div className='container mx-auto max-w-7xl px-4 pb-2.5 md:hidden'>
					<SearchBar />
				</div>
			</header>
			<CartSidebar />
		</>
	)
}

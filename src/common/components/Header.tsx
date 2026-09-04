'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { DesktopSearchBar, MobileSearchToggle } from '@/common/components/SearchBar'
import { UI_URLS, type NavLink } from '@/common/constants'
import { MobileMenu } from '@/common/components/MobileMenu'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { CartSidebar } from '@/common/components/CartSidebar'

// `ssr: false` is safe here: `user` comes from a skipHydration Zustand store that
// only rehydrates after mount, so the server never renders this branch anyway.
const UserMenu = dynamic(() => import('@/common/components/UserMenu').then(m => m.UserMenu), {
	ssr: false
})

export function Header({ navLinks }: { navLinks: NavLink[] }) {
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
			<header className='border-border bg-background/80 sticky top-0 z-50 border-b backdrop-blur-lg'>
				<div className='container mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4'>
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
							className='h-10 w-auto'
						/>
						<span className='gradient-text text-4xl leading-none font-bold'>
							Fillando
						</span>
					</Link>

					<div className='hidden min-w-0 flex-1 items-center justify-center gap-6 md:flex'>
						<nav className='flex shrink-0 items-center gap-6'>
							{navLinks.map(({ href, label }) => (
								<Link
									key={href}
									href={href}
									className='text-muted-foreground hover:text-primary text-sm font-medium whitespace-nowrap transition-colors'
								>
									{label}
								</Link>
							))}
						</nav>
						<DesktopSearchBar />
					</div>

					<div className='flex shrink-0 items-center gap-2'>
						<MobileSearchToggle />
						<div className='relative'>
							<button
								onClick={openCart}
								aria-label='Кошик'
								className='border-border/50 bg-card hover:border-primary hover:text-primary flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors'
							>
								<ShoppingCart className='h-4 w-4' />
							</button>
							{totalCount > 0 && (
								<span className='bg-primary text-primary-foreground pointer-events-none absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold'>
									{totalCount > 99 ? '99+' : totalCount}
								</span>
							)}
						</div>

						{!user ? (
							<Link
								href={UI_URLS.AUTH.LOGIN}
								className='border-border/50 bg-card hover:border-primary hover:text-primary flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors'
							>
								Увійти
							</Link>
						) : (
							<UserMenu user={user} onLogout={handleLogout} />
						)}
					</div>
				</div>
			</header>
			<CartSidebar />
		</>
	)
}

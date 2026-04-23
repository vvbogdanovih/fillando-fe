'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, ChevronDown, ShoppingCart, UserRound } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { UI_URLS, Role } from '@/common/constants'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { CartSidebar } from '@/common/components/CartSidebar'
import { cn } from '@/common/utils/shad-cn.utils'

const itemCls = cn(
	'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors',
	'hover:bg-accent focus:bg-accent'
)

export function Header() {
	const user = useAuthStore(s => s.user)
	const logOut = useAuthStore(s => s.logOut)
	const resetServerCart = useCartStore(s => s.resetServerCart)
	const openCart = useCartStore(s => s.openCart)
	const items = useCartStore(s => s.items)
	const guestItems = useCartStore(s => s.guestItems)
	const router = useRouter()
	const isPrivileged = user?.role === Role.ADMIN || user?.role === Role.MODERATOR
	const [avatarError, setAvatarError] = useState(false)

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
				<div className='container mx-auto flex h-16 max-w-7xl items-center justify-between px-4'>
					<Link
						href='/'
						className='flex items-center gap-2 transition-opacity hover:opacity-80'
					>
						<Image src='/Fillando.png' alt='Fillando' width={120} height={40} className='h-10 w-auto' />
						<span className='gradient-text text-4xl font-bold leading-none'>Fillando</span>
					</Link>

					<nav className='hidden items-center gap-6 md:flex'>
						<Link
							href={UI_URLS.HOME}
							className='text-muted-foreground hover:text-primary text-sm font-medium transition-colors'
						>
							Головна
						</Link>
						<Link
							href={UI_URLS.CATALOG.FILAMENT}
							className='text-muted-foreground hover:text-primary text-sm font-medium transition-colors'
						>
							Матеріали
						</Link>
					</nav>

					<div className='flex items-center gap-2'>
						<div className='relative'>
							<button
								onClick={openCart}
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
							<DropdownMenu.Root>
								<DropdownMenu.Trigger asChild>
									<button className='border-border/50 bg-card hover:border-border flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none'>
										{user.picture && !avatarError ? (
											<img
												src={user.picture}
												alt={user.name}
												className='h-6 w-6 rounded-full object-cover'
												onError={() => setAvatarError(true)}
											/>
										) : (
											<div className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold'>
												{user.name[0].toUpperCase()}
											</div>
										)}
										<span className='font-medium'>{user.name}</span>
										<ChevronDown className='text-muted-foreground h-3.5 w-3.5' />
									</button>
								</DropdownMenu.Trigger>

								<DropdownMenu.Portal>
									<DropdownMenu.Content
										align='end'
										sideOffset={8}
										className='border-border/50 bg-card animate-in fade-in-0 zoom-in-95 z-50 min-w-52 rounded-xl border p-1.5 shadow-lg shadow-black/10'
									>
										<div className='border-border/50 mb-1 border-b px-3 py-2'>
											<p className='text-sm font-medium'>{user.name}</p>
											<p className='text-muted-foreground text-xs'>
												{user.email}
											</p>
											<span className='bg-primary/10 text-primary mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize'>
												{user.role.toLowerCase()}
											</span>
										</div>

										{isPrivileged && (
											<DropdownMenu.Item asChild>
												<Link href={UI_URLS.ADMIN.BASE} className={itemCls}>
													<LayoutDashboard className='text-muted-foreground h-4 w-4' />
													Панель адміністратора
												</Link>
											</DropdownMenu.Item>
										)}

										<DropdownMenu.Item asChild>
											<Link href={UI_URLS.ACCOUNT.BASE} className={itemCls}>
												<UserRound className='text-muted-foreground h-4 w-4' />
												Особистий кабінет
											</Link>
										</DropdownMenu.Item>

										<DropdownMenu.Separator className='bg-border/50 my-1 h-px' />

										<DropdownMenu.Item asChild>
											<button
												onClick={handleLogout}
												className={cn(
													itemCls,
													'text-destructive hover:bg-destructive/10 focus:bg-destructive/10 w-full'
												)}
											>
												<LogOut className='h-4 w-4' />
												Вийти
											</button>
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Portal>
							</DropdownMenu.Root>
						)}
					</div>
				</div>
			</header>
			<CartSidebar />
		</>
	)
}

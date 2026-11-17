'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LayoutDashboard, LogOut, ChevronDown, UserRound } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { UI_URLS, Role } from '@/common/constants'
import type { User } from '@/common/types'
import { cn } from '@/common/utils/shad-cn.utils'

const itemCls = cn(
	'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors',
	'hover:bg-accent focus:bg-accent'
)

interface UserMenuProps {
	user: User
	onLogout: () => void
	/** The header's action look («Кабінет» with its icon, TD-0015); the name is inside the menu. */
	className?: string
}

/**
 * Signed-in account dropdown. Split out of `Header` and loaded lazily so that
 * Radix Popper + @floating-ui (~11 KB gz) stay out of the shared storefront
 * chunk — the overwhelming majority of catalog traffic is signed out.
 */
export function UserMenu({ user, onLogout, className }: UserMenuProps) {
	const [avatarError, setAvatarError] = useState(false)
	const isPrivileged = user.role === Role.ADMIN || user.role === Role.MODERATOR

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button
					aria-label={`Кабінет: ${user.name}`}
					className={cn('focus:outline-none', className)}
				>
					{user.picture && !avatarError ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={user.picture}
							alt=''
							referrerPolicy='no-referrer'
							className='size-[22px] rounded-full object-cover'
							onError={() => setAvatarError(true)}
						/>
					) : (
						<span
							aria-hidden
							className='bg-primary text-primary-foreground flex size-[22px] items-center justify-center rounded-full text-[11px] font-bold'
						>
							{user.name[0].toUpperCase()}
						</span>
					)}
					<span className='flex items-center gap-0.5'>
						Кабінет
						<ChevronDown className='text-muted-foreground size-3' aria-hidden />
					</span>
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
						<p className='text-muted-foreground text-xs'>{user.email}</p>
						<span className='bg-primary/10 text-primary-strong mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize'>
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
							onClick={onLogout}
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
	)
}

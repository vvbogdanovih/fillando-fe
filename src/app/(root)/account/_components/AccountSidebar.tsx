'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound, Package, Settings } from 'lucide-react'
import { UI_URLS } from '@/common/constants'
import { cn } from '@/common/utils/shad-cn.utils'

const sections = [
	{
		title: 'Профіль',
		href: UI_URLS.ACCOUNT.PROFILE,
		icon: UserRound
	},
	{
		title: 'Мої замовлення',
		href: UI_URLS.ACCOUNT.ORDERS,
		icon: Package
	},
	{
		title: 'Налаштування',
		href: UI_URLS.ACCOUNT.SETTINGS,
		icon: Settings
	}
]

export function AccountSidebar() {
	const pathname = usePathname()

	return (
		<aside className='bg-card border-border h-fit rounded-xl border p-2'>
			<nav className='space-y-1'>
				{sections.map(section => {
					const Icon = section.icon
					const isActive = pathname === section.href

					return (
						<Link
							key={section.href}
							href={section.href}
							className={cn(
								'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
								isActive && 'bg-primary/10 text-primary'
							)}
						>
							<Icon className='h-4 w-4' />
							{section.title}
						</Link>
					)
				})}
			</nav>
		</aside>
	)
}

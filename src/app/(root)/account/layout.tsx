import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { PrivateRoute } from '@/common/components/guards/PrivateRoute'
import { AccountSidebar } from './_components/AccountSidebar'
import { NO_INDEX } from '@/common/constants/seo.constants'

export const metadata: Metadata = { ...NO_INDEX }

export default function AccountLayout({ children }: { children: ReactNode }) {
	return (
		<PrivateRoute>
			<div className='container mx-auto max-w-7xl px-4 py-8'>
				<div className='mb-6'>
					<h1 className='text-2xl font-semibold'>Особистий кабінет</h1>
					<p className='text-muted-foreground mt-1 text-sm'>
						Тут будуть доступні всі персональні розділи користувача.
					</p>
				</div>

				<div className='grid gap-6 md:grid-cols-[240px_1fr]'>
					<AccountSidebar />
					<section className='bg-card border-border min-h-[420px] rounded-xl border p-5'>
						{children}
					</section>
				</div>
			</div>
		</PrivateRoute>
	)
}

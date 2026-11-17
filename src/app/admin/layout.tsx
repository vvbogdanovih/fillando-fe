import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PrivateRoute } from '@/common/components/guards/PrivateRoute'
import { Role } from '@/common/constants'
import { UI_URLS } from '@/common/constants'
import { AdminSidebar } from './_components/AdminSidebar'
import { NO_INDEX } from '@/common/constants/seo.constants'

export const metadata: Metadata = { ...NO_INDEX, title: 'Адмін-панель' }

// The admin keeps Inter; the storefront moved to Onest + Unbounded (TD-0015).
const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'] })

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<PrivateRoute allowedRoles={[Role.ADMIN]} redirectTo={UI_URLS.HOME}>
			<div className={`${inter.className} bg-muted fixed inset-0 flex overflow-hidden`}>
				<AdminSidebar />
				<div className='flex-1 overflow-auto pt-[52px] md:pt-0'>{children}</div>
			</div>
		</PrivateRoute>
	)
}

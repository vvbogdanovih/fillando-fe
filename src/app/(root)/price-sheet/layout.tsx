import { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Прайс-лист' }

// Dedicated full-width layout so the wide price-sheet table fits (no max-w-7xl).
export default function PriceSheetLayout({ children }: { children: ReactNode }) {
	return <div className='w-full px-4 py-6 lg:px-8'>{children}</div>
}

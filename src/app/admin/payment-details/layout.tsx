import type { ReactNode } from 'react'

export default function PaymentDetailsLayout({ children }: { children: ReactNode }) {
	return <div className='flex h-full min-h-0 flex-col'>{children}</div>
}

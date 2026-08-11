'use client'

import Link from 'next/link'
import { UI_URLS } from '@/common/constants'
import { useConsentStore } from '@/common/store/useConsentStore'

/**
 * Cookie-consent banner gating the Google Ads tag.
 *
 * `position: fixed` keeps it out of document flow, so it cannot shift layout (CLS
 * is currently 0 on every page and must stay there) and cannot become the LCP
 * element. Only opacity/transform animate.
 *
 * Renders nothing until the persisted store has rehydrated — during that window
 * `status` is 'unknown' but so is the real answer, and flashing the banner at a
 * visitor who already decided would be worse than a beat of delay.
 */
export function CookieConsentBanner() {
	const status = useConsentStore(s => s.status)
	const isReopened = useConsentStore(s => s.isReopened)
	const accept = useConsentStore(s => s.accept)
	const decline = useConsentStore(s => s.decline)

	const isVisible = status === 'unknown' || isReopened
	if (!isVisible) return null

	return (
		// Named with aria-label rather than a heading: the storefront layout streams
		// ahead of the Suspense-wrapped page body, so a heading here would land before
		// the page's <h1> in the DOM and fail the heading-order audit.
		<div
			role='dialog'
			aria-modal='false'
			aria-label='Згода на використання файлів cookie'
			className='animate-in fade-in slide-in-from-bottom-4 fixed inset-x-0 bottom-0 z-50 duration-300'
		>
			<div className='border-border/50 bg-card mx-auto mb-4 flex max-w-3xl flex-col gap-4 rounded-xl border p-5 shadow-lg shadow-black/20 sm:flex-row sm:items-center max-sm:mx-4'>
				<div className='flex-1 space-y-1'>
					<p className='text-sm font-semibold'>Ми використовуємо файли cookie</p>
					<p className='text-muted-foreground text-xs leading-relaxed'>
						Аналітичні та рекламні cookie допомагають нам оцінювати ефективність
						реклами. Без вашої згоди вони не завантажуються. Деталі —{' '}
						<Link href={UI_URLS.PRIVACY} className='text-primary-strong underline'>
							у політиці конфіденційності
						</Link>
						.
					</p>
				</div>
				<div className='flex shrink-0 gap-2'>
					<button
						type='button'
						onClick={decline}
						className='border-border/50 hover:bg-accent min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
					>
						Лише необхідні
					</button>
					<button
						type='button'
						onClick={accept}
						className='bg-primary hover:bg-primary/80 min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-black transition-colors'
					>
						Прийняти
					</button>
				</div>
			</div>
		</div>
	)
}

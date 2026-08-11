'use client'

import { useConsentStore } from '@/common/store/useConsentStore'

/** Footer control that reopens the consent banner. Isolated into its own client
 *  component so `Footer` stays a server component. */
export function CookieSettingsButton() {
	const reopen = useConsentStore(s => s.reopen)

	return (
		<button
			type='button'
			onClick={reopen}
			className='text-muted-foreground hover:text-primary-strong text-xs transition-colors'
		>
			Налаштування cookie
		</button>
	)
}

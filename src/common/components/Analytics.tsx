'use client'

import Script from 'next/script'
import { GOOGLE_ADS_ID } from '@/common/constants/analytics.constants'
import { useConsentStore } from '@/common/store/useConsentStore'

/**
 * Google Ads tag, mounted only after the visitor has granted cookie consent.
 *
 * Not rendering the <Script> at all is what actually removes the ~57 KB of gtag.js
 * and the third-party cookies behind it. Consent Mode alone would keep loading the
 * script and only suppress the cookie writes.
 *
 * Events fired before consent are not lost: `common/lib/gtag.ts` pushes onto
 * `window.dataLayer`, and gtag.js drains that queue when it loads.
 */
export function Analytics() {
	const status = useConsentStore(s => s.status)

	if (status !== 'granted') return null

	return (
		<>
			<Script
				async
				src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
				strategy='afterInteractive'
			/>
			<Script id='google-gtag' strategy='afterInteractive'>
				{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('js', new Date());
					gtag('config', '${GOOGLE_ADS_ID}');
				`}
			</Script>
		</>
	)
}

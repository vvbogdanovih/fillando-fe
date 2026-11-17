'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { GOOGLE_ADS_ID } from '@/common/constants/analytics.constants'
import { captureClickIds, syncClickIdsWithConsent } from '@/common/lib/ads-attribution'
import { consentSignals } from '@/common/lib/consent-mode'
import { gtag } from '@/common/lib/gtag'
import { useConsentStore } from '@/common/store/useConsentStore'

/**
 * The Google tag under Consent Mode v2 (owner, 2026-11-16).
 *
 * gtag.js loads for every visitor. Until «Прийняти» all four consent signals are `denied`: the
 * tag writes and reads no cookies and sends cookieless pings, from which Google models the
 * conversions it cannot observe. The denied default, the stored answer and the tag's `config`
 * are queued by the inline script in the root layout (`consentBootstrapScript`) before anything
 * else runs; this component loads the library and reports a change of the answer.
 *
 * It also keeps the ad click id of the visit (`ads-attribution.ts`), under the same answer.
 *
 * GA4 rides on the same tag: one loader, a second `config` line. The Ads pixel stays the only
 * conversion source for bidding; GA4 supplies the auxiliary signals (view_item, add_to_cart,
 * begin_checkout) Performance Max wants at a low order volume (TD-0006 §5.5).
 */
/**
 * A dev server or an E2E run. The library is not loaded there: the tag id falls back to the
 * production Ads account, and since the tag no longer waits for «Прийняти» every local page view
 * and test order would be reported to it. The queue is still filled, so tests read `dataLayer`.
 */
const isLocalHost = (hostname: string) =>
	/^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname) || hostname.endsWith('.localhost')

export function Analytics() {
	const status = useConsentStore(s => s.status)
	// Decided after mount: the server does not know the host the page is opened on.
	const [load, setLoad] = useState(false)
	useEffect(() => setLoad(!isLocalHost(window.location.hostname)), [])

	// Declared first: the ids of this page load must be in memory before the answer is applied.
	useEffect(() => {
		captureClickIds(window.location.search)
	}, [])

	useEffect(() => {
		if (status === 'unknown') return
		gtag('consent', 'update', consentSignals(status === 'granted'))
		syncClickIdsWithConsent(status)
	}, [status])

	if (!load) return null

	return (
		<Script
			async
			src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
			strategy='afterInteractive'
		/>
	)
}

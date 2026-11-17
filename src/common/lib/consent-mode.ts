import {
	CONSENT_STORAGE_KEY,
	GOOGLE_ADS_ID,
	GOOGLE_ANALYTICS_ID
} from '@/common/constants/analytics.constants'

/** The four Consent Mode v2 signals; the banner answers all of them with one choice. */
const SIGNALS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'] as const

export type ConsentSignals = Record<(typeof SIGNALS)[number], 'granted' | 'denied'>

export const consentSignals = (granted: boolean): ConsentSignals => {
	const value = granted ? 'granted' : 'denied'
	return {
		ad_storage: value,
		ad_user_data: value,
		ad_personalization: value,
		analytics_storage: value
	}
}

/**
 * The inline script the root layout prints first in `<body>` (Consent Mode v2, owner 2026-11-16).
 *
 * It runs before any React effect, so the queue always starts the same way: consent denied by
 * default, the visitor's stored «Прийняти» applied at once (read straight from the persisted
 * consent store — the store itself rehydrates only after mount), then the tag's `js` / `config`.
 * Events queued later by `gtag()` can therefore never precede the consent state they are sent
 * under. gtag.js itself is loaded by `Analytics`.
 */
export const consentBootstrapScript = () =>
	[
		'window.dataLayer=window.dataLayer||[];',
		'function gtag(){dataLayer.push(arguments)}',
		`gtag('consent','default',${JSON.stringify(consentSignals(false))});`,
		`try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)})||'null');`,
		`if(s&&s.state&&s.state.status==='granted')gtag('consent','update',${JSON.stringify(consentSignals(true))})}catch(e){}`,
		"gtag('js',new Date());",
		`gtag('config',${JSON.stringify(GOOGLE_ADS_ID)},{allow_enhanced_conversions:true});`,
		GOOGLE_ANALYTICS_ID ? `gtag('config',${JSON.stringify(GOOGLE_ANALYTICS_ID)});` : ''
	].join('')

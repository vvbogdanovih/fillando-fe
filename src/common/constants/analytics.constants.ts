/** Google Ads tag. Overridable per environment so staging cannot pollute
 *  production conversion data. */
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? 'AW-18332229942'

export const GOOGLE_ADS_PURCHASE_CONVERSION =
	process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION ?? 'AW-18332229942/vho6CLCit9McELbCvqVE'

/** localStorage key holding the visitor's cookie choice. Deliberately NOT a cookie:
 *  writing one from JS is what triggers Chrome's `CacheControlNoStoreCookieModified`
 *  and disqualifies pages from the back/forward cache. */
export const CONSENT_STORAGE_KEY = 'fillando-consent'

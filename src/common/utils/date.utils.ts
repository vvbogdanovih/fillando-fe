import { SHOP_TIME_ZONE } from './price.utils'

/**
 * `<input type="datetime-local">` speaks local wall-clock time without a zone; the API speaks
 * ISO 8601 in UTC. These two are the only translation between them, shared by every admin form
 * that edits a date (coupons' `valid_until`, promotions' `promo_ends_at`).
 */

/** An ISO string from the API → the `YYYY-MM-DDTHH:mm` the input wants, in the browser's zone. */
export function toDateTimeLocal(dateString: string | null | undefined): string {
	if (!dateString) return ''
	const d = new Date(dateString)
	if (Number.isNaN(d.getTime())) return ''
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** «01.11.2026, 12:00» in the shop's zone — how the admin reads any stored date-time. */
export function formatAdminDateTime(iso: string | null | undefined): string {
	if (!iso) return ''
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return ''
	return d.toLocaleString('uk-UA', {
		dateStyle: 'short',
		timeStyle: 'short',
		timeZone: SHOP_TIME_ZONE
	})
}

/** The input's local value → ISO 8601 UTC for the API. */
export function fromDateTimeLocal(value: string): string {
	return new Date(value).toISOString()
}

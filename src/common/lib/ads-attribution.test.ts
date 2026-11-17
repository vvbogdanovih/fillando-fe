import { beforeEach, describe, expect, it } from 'vitest'
import { useConsentStore } from '@/common/store/useConsentStore'
import {
	captureClickIds,
	orderAttribution,
	parseClickIds,
	rememberOrderContact,
	resetPendingClickIds,
	syncClickIdsWithConsent,
	takeOrderContact
} from './ads-attribution'

const KEY = 'fillando-click-ids'
const DAY = 24 * 60 * 60 * 1000
const consent = (status: 'unknown' | 'granted' | 'denied') => useConsentStore.setState({ status })

describe('ads-attribution — click ids', () => {
	beforeEach(() => {
		window.localStorage.clear()
		window.sessionStorage.clear()
		resetPendingClickIds()
		consent('unknown')
	})

	it('reads the three Google click ids and nothing else from a landing URL', () => {
		expect(parseClickIds('?gclid=Cj0K_a-1&utm_source=google&wbraid=0AAA')).toEqual({
			gclid: 'Cj0K_a-1',
			wbraid: '0AAA'
		})
		expect(parseClickIds('?utm_source=google')).toBeNull()
		// Not a click id's alphabet: never stored, never sent.
		expect(parseClickIds('?gclid=<script>')).toBeNull()
	})

	it('writes nothing to storage and sends nothing before the visitor answers', () => {
		captureClickIds('?gclid=Cj0K_a-1')
		syncClickIdsWithConsent('unknown')

		expect(window.localStorage.getItem(KEY)).toBeNull()
		expect(orderAttribution()).toEqual({ consent: 'unknown' })
	})

	it('keeps the click id once the visitor accepts, and sends it with the order', () => {
		captureClickIds('?gclid=Cj0K_a-1')
		consent('granted')
		// Sent even before it reaches storage — the same page load.
		expect(orderAttribution()).toEqual({ consent: 'granted', gclid: 'Cj0K_a-1' })

		syncClickIdsWithConsent('granted')
		expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toMatchObject({
			gclid: 'Cj0K_a-1'
		})
		// A later visit without a click id in the URL still carries the stored one.
		resetPendingClickIds()
		captureClickIds('')
		expect(orderAttribution()).toEqual({ consent: 'granted', gclid: 'Cj0K_a-1' })
	})

	it('a newer click replaces the stored one', () => {
		consent('granted')
		captureClickIds('?gclid=old')
		syncClickIdsWithConsent('granted')
		captureClickIds('?gbraid=new')
		syncClickIdsWithConsent('granted')

		expect(orderAttribution()).toEqual({ consent: 'granted', gbraid: 'new' })
	})

	it('forgets everything on «Лише необхідні»', () => {
		consent('granted')
		captureClickIds('?gclid=Cj0K_a-1')
		syncClickIdsWithConsent('granted')

		consent('denied')
		syncClickIdsWithConsent('denied')

		expect(window.localStorage.getItem(KEY)).toBeNull()
		expect(orderAttribution()).toEqual({ consent: 'denied' })
	})

	it('«Лише необхідні» also removes what gtag.js stored — cookies and localStorage — and nothing else', () => {
		document.cookie = '_gcl_aw=GCL.1.Cj0K_a-1; path=/'
		document.cookie = '_gcl_au=1.1.2; path=/'
		document.cookie = '_ga_ABC123=GS1.1; path=/'
		document.cookie = '_gallery=keep; path=/'
		// The tag's own copy of the click id, and a key of ours it must not touch.
		window.localStorage.setItem('_gcl_ls', '{"gclid":"Cj0K_a-1"}')
		window.localStorage.setItem('fillando-consent', 'kept')

		syncClickIdsWithConsent('denied')

		expect(document.cookie).toBe('_gallery=keep')
		expect(Object.keys(window.localStorage)).toEqual(['fillando-consent'])
		document.cookie = '_gallery=; Max-Age=0; path=/'
	})

	it('drops a click older than 90 days', () => {
		consent('granted')
		window.localStorage.setItem(KEY, JSON.stringify({ gclid: 'Cj0K_a-1', at: 1_000 }))

		expect(orderAttribution(1_000 + 89 * DAY)).toEqual({
			consent: 'granted',
			gclid: 'Cj0K_a-1'
		})
		expect(orderAttribution(1_000 + 91 * DAY)).toEqual({ consent: 'granted' })
	})

	it('survives a damaged storage entry', () => {
		consent('granted')
		window.localStorage.setItem(KEY, '{not json')
		expect(orderAttribution()).toEqual({ consent: 'granted' })
	})
})

describe('ads-attribution — order contact', () => {
	beforeEach(() => {
		window.sessionStorage.clear()
		consent('granted')
	})

	it('hands the contact to the order it was kept for, once', () => {
		rememberOrderContact('FO-0000123', { email: ' Buyer@Example.com', phone: '+380991234567' })

		expect(takeOrderContact('FO-0000456')).toBeNull()
		expect(takeOrderContact('FO-0000123')).toEqual({
			email: 'buyer@example.com',
			phone_number: '+380991234567'
		})
		expect(takeOrderContact('FO-0000123')).toBeNull()
	})

	it('keeps nothing without consent', () => {
		consent('denied')
		rememberOrderContact('FO-0000123', { email: 'a@example.com', phone: '+380991234567' })
		expect(window.sessionStorage.length).toBe(0)
	})
})

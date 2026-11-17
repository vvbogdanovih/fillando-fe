import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_STORAGE_KEY } from '@/common/constants/analytics.constants'
import { consentBootstrapScript, consentSignals } from './consent-mode'

type Call = unknown[]

/** Runs the inline script as the browser would and returns what it queued. */
const boot = (): Call[] => {
	const w = window as unknown as { dataLayer?: unknown[] }
	delete w.dataLayer
	new Function(consentBootstrapScript())()
	return (w.dataLayer ?? []).map(entry => Array.from(entry as ArrayLike<unknown>))
}

describe('consent-mode', () => {
	afterEach(() => {
		window.localStorage.clear()
		vi.restoreAllMocks()
	})

	it('answers all four Consent Mode v2 signals with one choice', () => {
		expect(consentSignals(false)).toEqual({
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied',
			analytics_storage: 'denied'
		})
		expect(Object.values(consentSignals(true))).toEqual(Array(4).fill('granted'))
	})

	it('a first visit starts denied, and the default precedes the tag config', () => {
		const calls = boot()

		expect(calls[0]).toEqual(['consent', 'default', consentSignals(false)])
		expect(calls.map(call => call[0])).toEqual(['consent', 'js', 'config'])
		expect(calls[2][1]).toMatch(/^AW-/)
	})

	it('a visitor who accepted earlier is granted before the config, without waiting for React', () => {
		window.localStorage.setItem(
			CONSENT_STORAGE_KEY,
			JSON.stringify({ state: { status: 'granted' }, version: 0 })
		)
		const calls = boot()

		expect(calls[1]).toEqual(['consent', 'update', consentSignals(true)])
		expect(calls.map(call => call[0])).toEqual(['consent', 'consent', 'js', 'config'])
	})

	it('a stored «Лише необхідні», a damaged entry and blocked storage all stay denied', () => {
		window.localStorage.setItem(
			CONSENT_STORAGE_KEY,
			JSON.stringify({ state: { status: 'denied' } })
		)
		expect(boot().filter(call => call[1] === 'update')).toEqual([])

		window.localStorage.setItem(CONSENT_STORAGE_KEY, '{not json')
		expect(boot().map(call => call[0])).toEqual(['consent', 'js', 'config'])

		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked')
		})
		expect(boot().map(call => call[0])).toEqual(['consent', 'js', 'config'])
	})
})

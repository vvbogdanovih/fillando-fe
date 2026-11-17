import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/script', () => ({
	default: ({ src }: { src: string }) => <script data-testid='gtag-loader' data-src={src} />
}))
vi.mock('@/common/lib/gtag', () => ({ gtag: vi.fn() }))

import { gtag } from '@/common/lib/gtag'
import { consentSignals } from '@/common/lib/consent-mode'
import { orderAttribution, resetPendingClickIds } from '@/common/lib/ads-attribution'
import { useConsentStore } from '@/common/store/useConsentStore'
import { Analytics } from './Analytics'

describe('Analytics — Consent Mode v2', () => {
	beforeEach(() => {
		vi.mocked(gtag).mockClear()
		window.localStorage.clear()
		resetPendingClickIds()
		window.history.replaceState(null, '', '/filament?gclid=Cj0K_a-1')
		act(() => useConsentStore.setState({ status: 'unknown', isReopened: false }))
	})

	afterEach(() => {
		vi.restoreAllMocks()
		cleanup()
		window.history.replaceState(null, '', '/')
	})

	it('loads gtag.js for a visitor who has not answered, and reports no consent of its own', () => {
		vi.spyOn(window, 'location', 'get').mockReturnValue({
			...window.location,
			hostname: 'fillando.com',
			search: '?gclid=Cj0K_a-1'
		})
		const { getByTestId } = render(<Analytics />)

		expect(getByTestId('gtag-loader').dataset.src).toContain('googletagmanager.com/gtag/js')
		// The denied default belongs to the inline bootstrap script, not to this component.
		expect(gtag).not.toHaveBeenCalled()
		expect(window.localStorage.getItem('fillando-click-ids')).toBeNull()
	})

	it('does not load gtag.js on a local stand — the fallback tag id is the production account', () => {
		const { queryByTestId } = render(<Analytics />)

		expect(window.location.hostname).toBe('localhost')
		expect(queryByTestId('gtag-loader')).toBeNull()
	})

	it('«Прийняти» grants the four signals and keeps the click id of this visit', () => {
		render(<Analytics />)
		act(() => useConsentStore.getState().accept())

		expect(gtag).toHaveBeenCalledWith('consent', 'update', consentSignals(true))
		expect(orderAttribution()).toEqual({ consent: 'granted', gclid: 'Cj0K_a-1' })
		expect(window.localStorage.getItem('fillando-click-ids')).toContain('Cj0K_a-1')
	})

	it('«Лише необхідні» after «Прийняти» withdraws the signals and forgets the click id', () => {
		render(<Analytics />)
		act(() => useConsentStore.getState().accept())
		act(() => useConsentStore.getState().decline())

		expect(gtag).toHaveBeenLastCalledWith('consent', 'update', consentSignals(false))
		expect(window.localStorage.getItem('fillando-click-ids')).toBeNull()
		expect(orderAttribution()).toEqual({ consent: 'denied' })
	})
})

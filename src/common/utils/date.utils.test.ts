import { describe, expect, it } from 'vitest'
import { fromDateTimeLocal, toDateTimeLocal } from './date.utils'

describe('datetime-local ↔ ISO', () => {
	it('round-trips a date through the input format in the local zone', () => {
		const iso = new Date(2026, 10, 1, 9, 30).toISOString()
		const local = toDateTimeLocal(iso)
		expect(local).toBe('2026-11-01T09:30')
		expect(fromDateTimeLocal(local)).toBe(iso)
	})

	it.each([null, undefined, '', 'nope'])('renders %p as an empty input', value => {
		expect(toDateTimeLocal(value)).toBe('')
	})
})

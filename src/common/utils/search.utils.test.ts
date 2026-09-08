import { describe, expect, it } from 'vitest'
import { includesNormalized, normalizeSearchText } from './search.utils'

describe('normalizeSearchText', () => {
	it('folds the apostrophes the data mixes for one word', () => {
		expect(normalizeSearchText('М’ятний')).toBe(normalizeSearchText("М'ятний"))
		expect(normalizeSearchText('Мʼятний')).toBe(normalizeSearchText("М'ятний"))
	})

	it('drops case, collapses whitespace and unifies dashes', () => {
		expect(normalizeSearchText('  Royal   BLUE ')).toBe('royal blue')
		expect(normalizeSearchText('Dual–Silk')).toBe('dual-silk')
	})

	it('treats composed and decomposed characters alike', () => {
		// «й» written as «и» + combining breve (U+0306) is the same letter once composed.
		expect(normalizeSearchText('Синій')).toBe('синій')
	})

	it('returns an empty string for blank input', () => {
		expect(normalizeSearchText('   ')).toBe('')
	})
})

describe('includesNormalized', () => {
	it('matches a substring regardless of case and apostrophe form', () => {
		expect(includesNormalized('М’ятно-зелений', "м'ятн")).toBe(true)
		expect(includesNormalized('Royal Blue', 'blue')).toBe(true)
	})

	it('never matches an empty needle or a missing haystack', () => {
		expect(includesNormalized('Black', '')).toBe(false)
		expect(includesNormalized(null, 'black')).toBe(false)
	})
})

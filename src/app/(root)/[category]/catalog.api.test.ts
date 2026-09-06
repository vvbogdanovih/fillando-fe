import { describe, expect, it, vi } from 'vitest'

vi.mock('@/common/services/http.service', () => ({ httpService: { get: vi.fn() } }))

import { catalogFacets } from './catalog.api'

describe('catalogFacets', () => {
	it('returns the facets as sent when the backend has them', () => {
		const facets = { polymer: [{ value: 'PLA', count: 24 }] }
		expect(catalogFacets({ facets, filter_options: { polymer: ['PLA'] } })).toBe(facets)
	})

	it('rebuilds the lists without numbers from a backend that predates facets', () => {
		expect(catalogFacets({ filter_options: { polymer: ['PLA', 'PETG'], finish: [] } })).toEqual(
			{
				polymer: [
					{ value: 'PLA', count: null },
					{ value: 'PETG', count: null }
				],
				finish: []
			}
		)
	})

	it('is empty, not undefined, when there is no response yet', () => {
		expect(catalogFacets(undefined)).toEqual({})
		expect(catalogFacets(null)).toEqual({})
	})
})

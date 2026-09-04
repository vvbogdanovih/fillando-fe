import { describe, expect, it } from 'vitest'
import { ATTR_KEY_OVERRIDES, normalizeAttrLabel, toAttrKey, toSlug } from './slug.utils'

/**
 * This table must stay byte-identical to `ATTR_KEY_OVERRIDES` in
 * `fillando-be/src/common/utils/attribute.utils.ts`. The two repos cannot import from each
 * other, so the guard is this literal: any drift here is a deliberate edit, not a typo.
 */
const OVERRIDE_TABLE: [label: string, key: string][] = [
	['Тип пластику', 'polymer'],
	['Ефект поверхні', 'finish'],
	['Армування', 'reinforcement'],
	['Серія', 'series'],
	['Котушка в комплекті', 'spool_included']
]

/** Keys currently stored in production — the override table must not touch them. */
const LIVE_KEYS: [label: string, key: string][] = [
	['Виробник', 'vyrobnyk'],
	['Вага', 'vaha'],
	['Діаметр', 'diametr'],
	['Матеріал', 'material'],
	['Колір', 'kolir']
]

describe('normalizeAttrLabel', () => {
	it.each([
		['leading and trailing spaces', '  Серія  ', 'серія'],
		['several inner spaces', 'Тип   пластику', 'тип пластику'],
		['a tab as separator', 'Тип\tпластику', 'тип пластику'],
		['a non-breaking space (U+00A0)', 'Тип\u00A0пластику', 'тип пластику'],
		['a non-breaking space around the label', '\u00A0Серія\u00A0', 'серія'],
		['upper case', 'СЕРІЯ', 'серія'],
		['mixed case', 'кОтУшКа В кОмПлЕкТі', 'котушка в комплекті']
	])('folds %s', (_case, input, expected) => {
		expect(normalizeAttrLabel(input)).toBe(expected)
	})

	it('composes decomposed Unicode input (NFC)', () => {
		// і + combining diaeresis → ї, и + combining breve → й
		expect(normalizeAttrLabel('\u0456\u0308')).toBe('\u0457')
		expect(normalizeAttrLabel('\u0438\u0306')).toBe('\u0439')
		expect('\u0456\u0308').not.toBe('\u0457')
	})
})

describe('toAttrKey', () => {
	describe('override table', () => {
		it.each(OVERRIDE_TABLE)('%s → %s', (label, key) => {
			expect(toAttrKey(label)).toBe(key)
		})

		it.each([
			['leading and trailing spaces', '  Серія  ', 'series'],
			['several inner spaces', 'Тип   пластику', 'polymer'],
			['a tab as separator', 'Тип\tпластику', 'polymer'],
			['a non-breaking space (U+00A0)', 'Тип\u00A0пластику', 'polymer'],
			['a non-breaking space around the label', '\u00A0Серія\u00A0', 'series'],
			['upper case', 'СЕРІЯ', 'series'],
			['lower case', 'ефект поверхні', 'finish'],
			['mixed case', 'кОтУшКа В кОмПлЕкТі', 'spool_included']
		])('reaches the override despite %s', (_case, input, key) => {
			expect(toAttrKey(input)).toBe(key)
		})

		it('gives decomposed and composed spellings of a label the same key', () => {
			// The lookup normalizes to NFC, the fallback to NFD — neither may depend on the
			// input form. None of the five override labels contains a composable letter
			// (`і`, `я`, `и` are atomic), so this case runs through the fallback.
			expect(toAttrKey('Кра\u0456\u0308на')).toBe(toAttrKey('Країна'))
			expect(toAttrKey('Кра\u0456\u0308на')).toBe('kraina')
		})

		it('does not fold Latin homoglyphs of Cyrillic letters into the override', () => {
			// 'поверхнi' with a Latin i (U+0069) is a different string, so it transliterates.
			expect(toAttrKey('Ефект поверхн\u0456')).toBe('finish')
			expect(toAttrKey('Ефект поверхн\u0069')).toBe('efekt_poverkhni')
		})

		it('leaves a Latin label that transliterates to the same key unchanged', () => {
			expect(toAttrKey('Series')).toBe('series')
		})
	})

	describe('keys live in production (regression guard)', () => {
		it.each(LIVE_KEYS)('%s → %s', (label, key) => {
			expect(toAttrKey(label)).toBe(key)
		})
	})

	describe('fallback transliteration', () => {
		it.each([
			['Температура друку (°C)', 'temperatura_druku_c'],
			['Швидкість-друку', 'shvydkist_druku'],
			['Країна', 'kraina'],
			['Йод', 'yod']
		])('%s → %s', (label, key) => {
			expect(toAttrKey(label)).toBe(key)
		})
	})

	describe('prototype keys are data, not functions', () => {
		it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
			'%s stays a plain string',
			name => {
				expect(typeof toAttrKey(name)).toBe('string')
				expect(toAttrKey(name)).toBe(name.toLowerCase())
			}
		)
	})
})

describe('ATTR_KEY_OVERRIDES invariants', () => {
	it('holds exactly the five catalogue filter dimensions of TD-0002 §5.2.1', () => {
		expect(ATTR_KEY_OVERRIDES).toEqual({
			'тип пластику': 'polymer',
			'ефект поверхні': 'finish',
			армування: 'reinforcement',
			серія: 'series',
			'котушка в комплекті': 'spool_included'
		})
	})

	it('stores every lookup key in normalized form', () => {
		for (const key of Object.keys(ATTR_KEY_OVERRIDES)) {
			expect(normalizeAttrLabel(key)).toBe(key)
		}
	})

	it('maps to unique, query-safe identifiers that are their own fixed point', () => {
		const values = Object.values(ATTR_KEY_OVERRIDES)
		expect(new Set(values).size).toBe(values.length)
		for (const value of values) {
			expect(value).toMatch(/^[a-z][a-z0-9_]*$/)
			expect(toAttrKey(value)).toBe(value)
		}
	})

	it('matches the labels the seeds and migrations write', () => {
		expect(
			Object.fromEntries(OVERRIDE_TABLE.map(([l, k]) => [normalizeAttrLabel(l), k]))
		).toEqual(ATTR_KEY_OVERRIDES)
	})
})

describe('toSlug is unaffected by the override table', () => {
	it.each([
		['Серія', 'seriia'],
		['Тип пластику', 'typ-plastyku'],
		['Котушка в комплекті', 'kotushka-v-komplekti']
	])('%s → %s', (label, slug) => {
		// Slugs are URLs, not filter keys. Routing them through the attribute overrides would
		// silently rewrite product and vendor addresses.
		expect(toSlug(label)).toBe(slug)
	})
})

describe('admin product form re-seed — modelled, not executed', () => {
	interface Attr {
		k: string
		l: string
		v: string
	}

	/**
	 * The re-seed logic of `ProductForm` / `ProductEditForm` (`_components/`): keys the form
	 * cannot reproduce from the label are treated as custom attributes and survive next to a
	 * freshly seeded blank row. Before the override mirror existed, a stored `series` met a
	 * recomputed `seriia` here and the product gained a second, empty "Серія".
	 */
	const reseed = (requiredAttrs: { label: string }[], stored: Attr[]): Attr[] => {
		const requiredKeys = new Set(requiredAttrs.map(attr => toAttrKey(attr.label)))
		const custom = stored.filter(field => !requiredKeys.has(field.k))
		return [
			...requiredAttrs.map(attr => ({ k: toAttrKey(attr.label), l: attr.label, v: '' })),
			...custom
		]
	}

	it('keeps one row per stored catalogue attribute', () => {
		const required = [{ label: 'Серія' }, { label: 'Тип пластику' }]
		const stored: Attr[] = [
			{ k: 'series', l: 'Серія', v: 'Plus' },
			{ k: 'polymer', l: 'Тип пластику', v: 'PLA' }
		]

		const result = reseed(required, stored)

		expect(result.map(a => a.k)).toEqual(['series', 'polymer'])
		expect(new Set(result.map(a => a.k)).size).toBe(result.length)
	})

	it('still carries genuinely custom attributes through', () => {
		const result = reseed([{ label: 'Серія' }], [{ k: 'tverdist', l: 'Твердість', v: '95A' }])

		expect(result).toEqual([
			{ k: 'series', l: 'Серія', v: '' },
			{ k: 'tverdist', l: 'Твердість', v: '95A' }
		])
	})
})

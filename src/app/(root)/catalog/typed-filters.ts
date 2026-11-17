import type { PublicDefinition, TypedScalar } from './typed-catalog.types'

/**
 * URL state of the typed catalogue (TD-0013 §6, SEO matrix §2–3).
 *
 * The address is the state: every filter, the sort, the page size and the page live in the
 * query string, so a reload, a shared link and the back button reproduce the listing. Values are
 * repeated parameters, never comma-joined — a comma is part of a value («Чорний, білий»).
 *
 *   f.<key>=<value>         one value of a multi-select characteristic (repeated = OR)
 *   f.<key>.min / .max      a numeric range characteristic, inclusive
 *   category=<id>           narrow a group or the whole catalogue to product categories
 *   brand=<id>              brand entity id (never the vendor)
 *   color=<family>          dictionary colour family, only where the category has a colour axis
 *   price.min / price.max   effective (promo-aware) price, inclusive
 *   in_stock=1              only SKUs with stock
 *   sort, limit, page       view parameters
 *
 * A parameter the page cannot interpret is not silently dropped: the parse fails, and the route
 * answers 404 as the SEO matrix requires, instead of serving a filtered-looking page that is not.
 * Advertising and analytics parameters are the exception — they never narrow anything.
 */

export type AttributeFilter =
	| { key: string; values: TypedScalar[] }
	| { key: string; min?: number; max?: number }

export interface TypedFilterState {
	attributes: AttributeFilter[]
	category_ids: string[]
	brand_ids: string[]
	color_families: string[]
	price?: { min?: number; max?: number }
	in_stock?: boolean
}

export const SORTS = ['newest', 'price_asc', 'price_desc'] as const
export type TypedSort = (typeof SORTS)[number]
export const DEFAULT_LIMIT = 24
export const LIMITS = [12, 24, 48] as const
/**
 * The legacy listings' page size and their «36 на сторінці» option (TD-0008), mapped once by a
 * permanent redirect — a transitional rule, owner decision 31.10.2026, to revisit after the Search
 * Console baseline (Plan-0010 D02): see `typedListingDecision`.
 */
export const LEGACY_LIMIT = { size: 12, option: '36', to: 48 } as const

export interface TypedListingState {
	filters: TypedFilterState
	sort: TypedSort
	limit: number
	page: number
	/** `?page=1` was written out — the route redirects to the bare address. */
	explicitFirstPage: boolean
	/** Advertising/analytics parameters were present; they never change the listing. */
	tracking: boolean
	/** `sort` or `limit` was written out — a view of the listing, never indexed. */
	view: boolean
	/** `?limit=36` of the legacy listing, read as 48 and redirected to it (transitional). */
	legacyLimit?: true
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

/**
 * What ad platforms, mailers and analytics append to an address by themselves. The one list for
 * the listings and the hub (`trackingQuery`): a key missing here is «a parameter the page cannot
 * interpret», so every such visit is a 404 — Google Ads auto-tagging adds `gad_source` and
 * `gad_campaignid` beside `gclid` to each click (review 2026-11-14).
 */
const TRACKING =
	/^(utm_[a-z_]+|gad_[a-z_]+|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|srsltid|yclid|ysclid|ttclid|twclid|igshid|li_fat_id|epik|mc_cid|mc_eid|_hsenc|_hsmi|_gl|_ga)$/
const OBJECT_ID = /^[a-f0-9]{24}$/
/**
 * Range bounds as the address writes them: plain decimals, up to ten integer digits and six
 * decimals. A price is never negative; a characteristic may be (−20 °C), as on the backend.
 */
const BOUND = {
	price: /^(0|[1-9]\d{0,9})(\.\d{1,6})?$/,
	attribute: /^-?(0|[1-9]\d{0,9})(\.\d{1,6})?$/
}
export type BoundKind = keyof typeof BOUND

export const emptyFilters = (): TypedFilterState => ({
	attributes: [],
	category_ids: [],
	brand_ids: [],
	color_families: []
})

/** The dictionary families (`ColorFamily` on the backend); any other `color=` value is invalid. */
export const COLOR_FAMILIES = [
	'black',
	'white',
	'gray',
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
	'pink',
	'brown',
	'gold',
	'silver',
	'transparent',
	'multicolor'
] as const

function entries(raw: RawParams): [string, string][] {
	if (raw instanceof URLSearchParams) return [...raw.entries()]
	return Object.entries(raw).flatMap(([key, value]) =>
		value === undefined
			? []
			: (Array.isArray(value) ? value : [value]).map(v => [key, v] as [string, string])
	)
}

/** A stored characteristic value from its URL spelling, or `undefined` when it cannot be one. */
export function parseValue(definition: PublicDefinition, raw: string): TypedScalar | undefined {
	if (raw === '' || raw.length > 2000) return undefined
	switch (definition.value_type) {
		case 'boolean':
			return raw === 'true' ? true : raw === 'false' ? false : undefined
		case 'number':
			return /^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(Number(raw))
				? Number(raw)
				: undefined
		case 'enum':
			return definition.options.some(option => option.id === raw) ? raw : undefined
		default:
			return raw
	}
}

/**
 * A bound from the address. The filter inputs and the slider apply only what this reads back from
 * `String(bound)` (what `listingQuery` writes), so they never produce an address that is a 404.
 */
export const parseBound = (raw: string, kind: BoundKind): number | undefined =>
	BOUND[kind].test(raw) ? Number(raw) : undefined

/**
 * Reads the listing state, or `null` when the address is not one this page produces. The only
 * characteristics accepted are the scope's own filterable definitions — a group and the whole
 * catalogue have none, as on the API (local filters are not mixed across categories).
 */
export function parseListingParams(
	raw: RawParams,
	definitions: PublicDefinition[]
): TypedListingState | null {
	const filterable = new Map(
		definitions.filter(definition => definition.filter_enabled).map(d => [d.key, d])
	)
	const values = new Map<string, TypedScalar[]>()
	const ranges = new Map<string, { min?: number; max?: number }>()
	const state: TypedListingState = {
		filters: emptyFilters(),
		sort: 'newest',
		limit: DEFAULT_LIMIT,
		page: 1,
		explicitFirstPage: false,
		tracking: false,
		view: false
	}
	const seen = new Set<string>()
	const once = (key: string) => {
		if (seen.has(key)) return false
		seen.add(key)
		return true
	}
	for (const [key, value] of entries(raw)) {
		if (TRACKING.test(key)) {
			state.tracking = true
			continue
		}
		if (key === 'page') {
			if (!once(key) || !/^[1-9]\d{0,5}$/.test(value)) return null
			state.page = Number(value)
			state.explicitFirstPage = state.page === 1
		} else if (key === 'sort') {
			if (!once(key) || !(SORTS as readonly string[]).includes(value)) return null
			state.sort = value as TypedSort
			state.view = true
		} else if (key === 'limit') {
			if (!once(key)) return null
			if (value === LEGACY_LIMIT.option) {
				state.limit = LEGACY_LIMIT.to
				state.legacyLimit = true
			} else if ((LIMITS as readonly number[]).map(String).includes(value))
				state.limit = Number(value)
			else return null
			state.view = true
		} else if (key === 'in_stock') {
			if (!once(key) || value !== '1') return null
			state.filters.in_stock = true
		} else if (key === 'category' || key === 'brand') {
			const list = key === 'category' ? state.filters.category_ids : state.filters.brand_ids
			if (!OBJECT_ID.test(value) || list.includes(value) || list.length >= 100) return null
			list.push(value)
		} else if (key === 'color') {
			const list = state.filters.color_families
			if (
				!definitions.some(definition => definition.semantic === 'color') ||
				!(COLOR_FAMILIES as readonly string[]).includes(value) ||
				list.includes(value)
			)
				return null
			list.push(value)
		} else if (key === 'price.min' || key === 'price.max') {
			const bound = parseBound(value, 'price')
			if (!once(key) || bound === undefined) return null
			state.filters.price = { ...state.filters.price, [key.slice(6)]: bound }
		} else if (key.startsWith('f.')) {
			const range = /^f\.(.+)\.(min|max)$/.exec(key)
			const definition = filterable.get(range ? range[1] : key.slice(2))
			if (!definition) return null
			if (definition.filter_type === 'range') {
				const bound = range ? parseBound(value, 'attribute') : undefined
				if (!range || !once(key) || bound === undefined) return null
				ranges.set(definition.key, { ...ranges.get(definition.key), [range[2]]: bound })
			} else {
				if (range) return null
				const parsed = parseValue(definition, value)
				const list = values.get(definition.key) ?? []
				if (parsed === undefined || list.includes(parsed) || list.length >= 100) return null
				values.set(definition.key, [...list, parsed])
			}
		} else {
			return null
		}
	}
	const inverted = (bounds?: { min?: number; max?: number }) =>
		bounds?.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max
	if (inverted(state.filters.price) || [...ranges.values()].some(inverted)) return null
	// Category order, not URL order: one state has one address.
	for (const definition of definitions) {
		if (values.has(definition.key))
			state.filters.attributes.push({
				key: definition.key,
				values: values.get(definition.key)!
			})
		if (ranges.has(definition.key))
			state.filters.attributes.push({ key: definition.key, ...ranges.get(definition.key)! })
	}
	return state
}

export const hasFilters = (filters: TypedFilterState) =>
	filters.attributes.length > 0 ||
	filters.category_ids.length > 0 ||
	filters.brand_ids.length > 0 ||
	filters.color_families.length > 0 ||
	filters.price !== undefined ||
	filters.in_stock !== undefined

/** The canonical query string for a state: stable order, defaults omitted, page 1 bare. */
export function listingQuery(
	state: Pick<TypedListingState, 'filters' | 'sort' | 'limit' | 'page'>
) {
	const query = new URLSearchParams()
	for (const filter of state.filters.attributes) {
		if ('values' in filter)
			for (const value of [...filter.values].sort((a, b) =>
				String(a).localeCompare(String(b))
			))
				query.append(`f.${filter.key}`, String(value))
		else {
			if (filter.min !== undefined) query.set(`f.${filter.key}.min`, String(filter.min))
			if (filter.max !== undefined) query.set(`f.${filter.key}.max`, String(filter.max))
		}
	}
	for (const id of [...state.filters.category_ids].sort()) query.append('category', id)
	for (const id of [...state.filters.brand_ids].sort()) query.append('brand', id)
	for (const family of [...state.filters.color_families].sort()) query.append('color', family)
	if (state.filters.price?.min !== undefined)
		query.set('price.min', String(state.filters.price.min))
	if (state.filters.price?.max !== undefined)
		query.set('price.max', String(state.filters.price.max))
	if (state.filters.in_stock) query.set('in_stock', '1')
	if (state.sort !== 'newest') query.set('sort', state.sort)
	if (state.limit !== DEFAULT_LIMIT) query.set('limit', String(state.limit))
	if (state.page > 1) query.set('page', String(state.page))
	return query.toString()
}

/** The `filters` JSON of `GET /products/catalog/v2`, empty parts omitted. */
export function apiFilters(filters: TypedFilterState): string {
	return JSON.stringify({
		...(filters.attributes.length ? { attributes: filters.attributes } : {}),
		...(filters.category_ids.length ? { category_ids: filters.category_ids } : {}),
		...(filters.brand_ids.length ? { brand_ids: filters.brand_ids } : {}),
		...(filters.color_families.length ? { color_families: filters.color_families } : {}),
		...(filters.price ? { price: filters.price } : {}),
		...(filters.in_stock !== undefined ? { in_stock: filters.in_stock } : {})
	})
}

/** Query parameters of `GET /products/catalog/v2` for one listing state. */
export function apiQuery(
	state: Pick<TypedListingState, 'filters' | 'sort' | 'limit' | 'page'>,
	categoryId: string | null
) {
	const query = new URLSearchParams()
	if (categoryId) query.set('category_id', categoryId)
	query.set('page', String(state.page))
	query.set('limit', String(state.limit))
	query.set('sort', state.sort)
	query.set('filters', apiFilters(state.filters))
	return query.toString()
}

/** «16 А», «Чотири», «Так» — the text a value is shown with, never an enum id. */
export function valueLabel(definition: PublicDefinition, value: TypedScalar): string {
	const label =
		definition.value_type === 'enum'
			? (definition.options.find(option => option.id === value)?.label ?? String(value))
			: typeof value === 'boolean'
				? value
					? 'Так'
					: 'Ні'
				: String(value)
	return definition.unit && definition.value_type !== 'boolean'
		? `${label} ${definition.unit}`
		: label
}

/** Replace one characteristic's filter; `null` removes it. */
export function withAttribute(
	filters: TypedFilterState,
	key: string,
	next: AttributeFilter | null,
	order: string[]
): TypedFilterState {
	const others = filters.attributes.filter(filter => filter.key !== key)
	const empty =
		!next ||
		('values' in next
			? next.values.length === 0
			: next.min === undefined && next.max === undefined)
	const attributes = empty ? others : [...others, next!]
	attributes.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
	return { ...filters, attributes }
}

/**
 * A landing's typed pins applied over the visitor's own narrowing (TD-0013): a pinned
 * characteristic replaces the visitor's choice for it, so the listing can never be wider than
 * the address promises. The visitor cannot even express one — pinned keys are removed from the
 * parser's definitions — so this is a second guard, not the only one.
 */
export function withPinned(filters: TypedFilterState, pinned: TypedFilterState | null) {
	if (!pinned) return filters
	const pinnedKeys = new Set(pinned.attributes.map(filter => filter.key))
	return {
		...filters,
		attributes: [
			...filters.attributes.filter(filter => !pinnedKeys.has(filter.key)),
			...pinned.attributes
		],
		category_ids: pinned.category_ids.length ? pinned.category_ids : filters.category_ids,
		brand_ids: pinned.brand_ids.length ? pinned.brand_ids : filters.brand_ids,
		color_families: pinned.color_families.length
			? pinned.color_families
			: filters.color_families,
		price: pinned.price ?? filters.price,
		in_stock: pinned.in_stock ?? filters.in_stock
	}
}

/** Definitions the visitor may filter by: a landing's pinned keys are part of its address. */
export const visitorDefinitions = (
	definitions: PublicDefinition[],
	pinned: TypedFilterState | null
) => {
	const pinnedKeys = new Set(pinned?.attributes.map(filter => filter.key) ?? [])
	return definitions
		.filter(definition => !pinnedKeys.has(definition.key))
		.map(definition =>
			definition.semantic === 'color' && pinned?.color_families.length
				? { ...definition, semantic: 'generic' as const }
				: definition
		)
}

/**
 * The same listing in the legacy v1 query format (`?polymer=PLA,PETG&color_family=black&
 * price_min=100`), translated to the typed format — or `null` when the address uses no legacy
 * parameter or does not translate into a valid listing. A migrated category answers such an
 * address with one permanent redirect instead of a 404, so old links and ads keep working.
 */
export function legacyListingQuery(
	raw: URLSearchParams,
	definitions: PublicDefinition[]
): URLSearchParams | null {
	const filterable = new Set(
		definitions
			.filter(definition => definition.filter_enabled && definition.filter_type !== 'range')
			.map(definition => definition.key)
	)
	const next = new URLSearchParams()
	let legacy = false
	for (const [key, value] of raw.entries()) {
		if (key === 'price_min' || key === 'price_max') {
			next.append(key === 'price_min' ? 'price.min' : 'price.max', value)
			legacy = true
		} else if (key === 'color_family') {
			for (const family of value.split(',').filter(Boolean)) next.append('color', family)
			legacy = true
		} else if (filterable.has(key)) {
			// The legacy catalogue split multi-values on commas; no stored value contains one.
			for (const item of value.split(',').filter(Boolean)) next.append(`f.${key}`, item)
			legacy = true
		} else next.append(key, value)
	}
	if (!legacy) return null
	const state = parseListingParams(next, definitions)
	if (!state) return null
	const query = new URLSearchParams(listingQuery(state))
	for (const [key, value] of trackingQuery(raw)) query.append(key, value)
	return query
}

/** The attribution parameters of an address (UTM, click ids) in their order — what every
 * redirect keeps, so an ad click still counts after it. */
export function trackingQuery(raw: URLSearchParams): URLSearchParams {
	const query = new URLSearchParams()
	for (const [key, value] of raw.entries()) if (TRACKING.test(key)) query.append(key, value)
	return query
}

/** Same narrowing, independent of value and dimension order (exact landing match, TD-0002 §5.4). */
export function sameFilters(a: TypedFilterState, b: TypedFilterState): boolean {
	const canonical = (filters: TypedFilterState) =>
		JSON.stringify({
			attributes: [...filters.attributes]
				.map(filter =>
					'values' in filter
						? {
								key: filter.key,
								values: [...filter.values].map(String).sort()
							}
						: { key: filter.key, min: filter.min ?? null, max: filter.max ?? null }
				)
				.sort((x, y) => x.key.localeCompare(y.key)),
			category_ids: [...filters.category_ids].sort(),
			brand_ids: [...filters.brand_ids].sort(),
			color_families: [...filters.color_families].sort(),
			price: filters.price ?? null,
			in_stock: filters.in_stock ?? null
		})
	return canonical(a) === canonical(b)
}

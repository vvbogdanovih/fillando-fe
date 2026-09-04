const CYRILLIC_MAP: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'h',
	ґ: 'g',
	д: 'd',
	е: 'e',
	є: 'ie',
	ж: 'zh',
	з: 'z',
	и: 'y',
	і: 'i',
	ї: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ь: '',
	ю: 'iu',
	я: 'ia'
}

/**
 * Explicit label → key overrides, consulted BEFORE transliteration.
 *
 * Mirror of `ATTR_KEY_OVERRIDES` in `fillando-be/src/common/utils/attribute.utils.ts`
 * (TD-0002 §5.2.1). Drift between the two tables shows up in two different ways.
 *
 * For `attributes[].k` and `required_attributes[].key` the backend recomputes the key from
 * the label on every save, so stored data stays consistent and the damage is confined to the
 * admin edit form: on a category change `ProductEditForm` re-seeds required attributes by
 * comparing `toAttrKey(attr.label)` with the stored `k`, so a key it cannot reproduce is
 * taken for a custom attribute and a blank required row is submitted beside it. (`ProductForm`
 * shares that effect but starts from an empty array, so it can only meet its own keys.)
 *
 * `variant_type.key` is different: this function is its only author and the backend stores it
 * verbatim (`VariantTypeDto.key` is a plain `@IsString()`), so drift there does reach the
 * database and breaks the `variant_type.key === attributes[].k` join the product page and the
 * edit form rely on.
 *
 * Change this table together with its spec (`slug.utils.test.ts` pins the five pairs), the
 * table in `CLAUDE.md`, the backend table, and
 * `fillando-be/scripts/migrations/normalize-attr-keys.js`.
 */
export const ATTR_KEY_OVERRIDES: Readonly<Record<string, string>> = {
	'тип пластику': 'polymer',
	'ефект поверхні': 'finish',
	армування: 'reinforcement',
	серія: 'series',
	'котушка в комплекті': 'spool_included'
}

/** Lookup form for `ATTR_KEY_OVERRIDES`: NFC, trimmed, single-spaced, lower-case. */
export const normalizeAttrLabel = (label: string): string =>
	label.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

export const toAttrKey = (label: string): string => {
	const normalized = normalizeAttrLabel(label)
	if (Object.hasOwn(ATTR_KEY_OVERRIDES, normalized)) return ATTR_KEY_OVERRIDES[normalized]

	return label
		.normalize('NFD')
		.toLowerCase()
		.split('')
		.map(ch => CYRILLIC_MAP[ch] ?? ch)
		.join('')
		.replace(/[\s-]+/g, '_')
		.replace(/[^a-z0-9_]/g, '')
}

export const toSlug = (label: string): string =>
	label
		.normalize('NFD')
		.toLowerCase()
		.split('')
		.map(ch => CYRILLIC_MAP[ch] ?? ch)
		.join('')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')

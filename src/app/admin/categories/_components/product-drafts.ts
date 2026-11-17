'use client'
import type { CategoryCommand } from '../category-tree.api'
import type { DescriptionValue } from '../../products/_components/DescriptionBlock'
import { productBody, storedDescription, storedDetailRows } from '../typed-product-body'
import { parseField, purchaseNoticeInput, type TypedProduct } from '../typed-product.schema'
import { fromDateTimeLocal } from '@/common/utils/date.utils'
import { productScope, useDraftScope } from './category-drafts'

/**
 * The product page's unsaved edits (owner, 2026-11-09: «дуже багато "зберегти" — треба одну
 * кнопку»): the characteristics, the promotion for every SKU, the purchase notice and the
 * description. Every one of them is a part of one product save (`productBody`), so the header's
 * «Зберегти» sends a single command. A variant is still saved in its own window, and moving,
 * archiving or deleting the product are actions, not edits.
 */
export type ProductSection = 'characteristics' | 'promotion' | 'notice' | 'description'

export const PRODUCT_SECTIONS: { id: ProductSection; label: string }[] = [
	{ id: 'characteristics', label: 'Характеристики' },
	{ id: 'promotion', label: 'Акція' },
	{ id: 'notice', label: 'Попередження' },
	{ id: 'description', label: 'Опис' }
]

export interface CharacteristicsDraft {
	name: string
	vendor: string
	axis: string
	/** The typed text of every field, by key (a characteristic with several values has several). */
	attributes: Record<string, string[]>
	/**
	 * Each SKU's value of the axis, by SKU id — read only while the axis itself is being changed.
	 * By id, never by position: SKUs are added and deleted while a draft waits.
	 */
	variants: Record<string, string>
}
/** `remove` takes the promotion off every SKU; otherwise a percent puts one on every SKU. */
export interface PromotionDraft {
	percent: string
	ends: string
	remove: boolean
}
export interface NoticeDraft {
	title: string
	text: string
	badge: string
}
export type DescriptionDraft = DescriptionValue | null

export const NO_PROMOTION: PromotionDraft = { percent: '', ends: '', remove: false }

/** The characteristics as stored, the form's starting point. */
export function characteristicsBase(product: TypedProduct): CharacteristicsDraft {
	// A required colour is every product's variation (owner, 2026-11-06).
	const colourAxis = product.definitions.find(
		def => def.semantic === 'color' && def.is_required
	)?.key
	return {
		name: product.name,
		vendor: product.vendor_id ?? '',
		axis: product.variant_axis?.key ?? colourAxis ?? '',
		attributes: Object.fromEntries(
			product.definitions.map(def => [
				def.key,
				product.attributes_v2
					.filter(entry => entry.k === def.key)
					.map(entry => String(entry.v))
			])
		),
		variants: Object.fromEntries(
			product.variants.map(row => [
				row.id,
				row.variant_value === null ? '' : String(row.variant_value)
			])
		)
	}
}

/**
 * The characteristics part of a save: typed values and each SKU's axis value, checked as the form
 * always checked them. Throws the message the admin reads.
 */
export function characteristicsValues(
	product: TypedProduct,
	draft: CharacteristicsDraft,
	rows: { id: string }[]
) {
	const definitions = [...product.definitions].sort((a, b) => a.order - b.order)
	const axisDefinition = definitions.find(def => def.key === draft.axis)
	const attributes_v2 = definitions
		.filter(def => def.key !== draft.axis && def.semantic !== 'color')
		.flatMap(def =>
			(draft.attributes[def.key] ?? []).flatMap(text => {
				const value = parseField(def, text)
				return value === null ? [] : [{ k: def.key, v: value }]
			})
		)
	// The axis as stored: each SKU's value is edited in its variant window, so the product as it is
	// now is sent — a draft begun before a SKU was recoloured, added or deleted would write its old
	// copy back, onto the wrong SKU after a deletion. Only a new axis takes the form's values.
	const stored =
		draft.axis === (product.variant_axis?.key ?? '')
			? new Map(product.variants.map(row => [row.id, row.variant_value]))
			: null
	const values = rows.map(row => ({
		id: row.id,
		variant_value: !axisDefinition
			? null
			: stored
				? (stored.get(row.id) ?? null)
				: parseField(axisDefinition, draft.variants[row.id] ?? '')
	}))
	if (!draft.axis && values.length !== 1)
		throw Error('Без осі товар повинен мати рівно один варіант.')
	if (draft.axis && values.some(row => row.variant_value === null))
		throw Error('Заповніть значення кожного варіанта.')
	if (draft.axis && new Set(values.map(row => row.variant_value)).size !== values.length)
		throw Error('Значення варіантів мають бути унікальними.')
	return { attributes_v2, values }
}

const DESCRIPTION_TOO_LONG =
	'Опис завеликий: разом із розміткою — до 100 000 символів. Якщо в текст вставлено зображення, приберіть його.'
/** The fields a save's schema can refuse, said the way the form names them. */
const FIELD_PROBLEMS: Record<string, string> = {
	name: 'Назва товару — від 1 до 200 символів.',
	price: 'Ціна — число від 0 до 1 000 000 000.',
	stock: 'Залишок — ціле число від 0.',
	weight_g: 'Вага для пошти — ціле число грамів, від 1.',
	html: DESCRIPTION_TOO_LONG,
	json: DESCRIPTION_TOO_LONG
}
type SchemaRefusal = { issues?: { path: PropertyKey[] }[] } | null
/**
 * A failed check as the sentence the admin reads. A schema refusal (zod) carries its issues as
 * JSON in `message`; it is said by the field it is about instead.
 */
export function problemText(error: unknown, fallback: string) {
	const path = (error as SchemaRefusal)?.issues?.[0]?.path
	if (!path) return error instanceof Error ? error.message : fallback
	const field = [...path].reverse().find(part => typeof part === 'string')
	return FIELD_PROBLEMS[String(field)] ?? fallback
}

/** A percent outside the 1–90 whole-number rule (empty is no promotion). */
export const promoError = (percent: string) =>
	!!percent &&
	!(Number.isInteger(Number(percent)) && Number(percent) >= 1 && Number(percent) <= 90)

/** The header's side of the product page: what is unsaved and the one command that saves it. */
export function useProductSave(product: TypedProduct | null) {
	const scope = useDraftScope(product ? productScope(product.product_id) : null)
	const unsaved = PRODUCT_SECTIONS.filter(section => scope.drafts[section.id])
	/** The command, or `null` when a block cannot be saved as it is (its issue is then shown). */
	const prepare = (): CategoryCommand | null => {
		if (!product || !unsaved.length) return null
		const draft = <T>(section: ProductSection) =>
			scope.drafts[section] ? (scope.drafts[section].value as T) : undefined
		const characteristics = draft<CharacteristicsDraft>('characteristics')
		const promotion = draft<PromotionDraft>('promotion')
		const notice = draft<NoticeDraft>('notice')
		const description = scope.drafts.description
			? (scope.drafts.description.value as DescriptionDraft)
			: undefined
		let refused = false
		const refuse = (section: ProductSection, message: string) => {
			scope.setIssue(section, { message })
			refused = true
		}
		let patch: Record<string, unknown> = {}
		if (characteristics) {
			try {
				const { attributes_v2, values } = characteristicsValues(
					product,
					characteristics,
					product.variants
				)
				patch = {
					...(characteristics.vendor &&
					characteristics.vendor !== (product.vendor_id ?? '')
						? { vendor_id: characteristics.vendor }
						: {}),
					name: characteristics.name,
					attributes_v2,
					variant_axis: characteristics.axis ? { key: characteristics.axis } : null,
					variants: values
				}
			} catch (error) {
				refuse(
					'characteristics',
					error instanceof Error ? error.message : 'Перевірте поля товару.'
				)
			}
		}
		if (promotion && !promotion.remove && (!promotion.percent || promoError(promotion.percent)))
			refuse('promotion', 'Відсоток акції — ціле число від 1 до 90.')
		let purchaseNotice: ReturnType<typeof purchaseNoticeInput> | undefined
		if (notice)
			try {
				purchaseNotice = purchaseNoticeInput(notice)
			} catch (error) {
				refuse('notice', error instanceof Error ? error.message : 'Перевірте попередження.')
			}
		if (refused) return null
		if ((promotion || notice || description !== undefined) && product.details) {
			const promo = promotion
				? promotion.remove
					? { promo_percent: null, promo_ends_at: null }
					: {
							promo_percent: Number(promotion.percent),
							promo_ends_at: promotion.ends ? fromDateTimeLocal(promotion.ends) : null
						}
				: null
			patch.details = {
				token: product.details.token,
				description:
					description !== undefined
						? description && { ...description, json: { ...description.json } }
						: storedDescription(product),
				variants: storedDetailRows(product).map(row =>
					promo ? { ...row, ...promo } : row
				),
				...(notice ? { purchase_notice: purchaseNotice } : {})
			}
		}
		try {
			return { type: 'product', id: product.product_id, body: productBody(product, patch) }
		} catch (error) {
			// Said in the block it is about: the description's own, else the first unsaved one.
			const path = (error as SchemaRefusal)?.issues?.[0]?.path
			refuse(
				path?.includes('description') ? 'description' : unsaved[0].id,
				problemText(error, 'Перевірте поля товару.')
			)
			return null
		}
	}
	return {
		unsaved,
		prepare,
		/** After the save succeeded: the drafts are the server's values now. */
		saved: () => scope.clear(),
		discard: () => scope.clear()
	}
}

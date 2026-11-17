import '@/common/lib/zod-locale'
import * as z from 'zod'
const order = z.number().int().nonnegative().safe()
export const definitionInputSchema = z
	.object({
		key: z.string().min(1).max(100).optional(),
		label: z.string().trim().min(1).max(200),
		value_type: z.enum(['string', 'number', 'boolean', 'enum']),
		unit: z.string().trim().min(1).max(50).nullable(),
		is_required: z.boolean(),
		filter_enabled: z.boolean(),
		filter_type: z.enum(['multi-select', 'range']).nullable(),
		visible_in_specs: z.boolean(),
		order,
		multiple: z.boolean(),
		/**
		 * `brand` (owner, 2026-11-05): where a v2 product without its own brand takes the brand for
		 * its page, JSON-LD and the feed — never guessed from a label like «Виробник».
		 */
		semantic: z.enum(['generic', 'color', 'size', 'material', 'brand']),
		options: z
			.array(
				z.object({
					id: z.string().min(1).max(100).optional(),
					label: z.string().trim().min(1).max(200),
					order
				})
			)
			.max(200)
	})
	.superRefine((value, ctx) => {
		const invalid = (path: string, message: string) =>
			ctx.addIssue({ code: 'custom', path: [path], message })
		if (value.filter_enabled !== (value.filter_type !== null))
			invalid('filter_type', 'Увімкнений фільтр потребує типу')
		if (value.filter_type === 'range' && (value.value_type !== 'number' || value.multiple))
			invalid('filter_type', 'Діапазон можливий лише для одного числового значення')
		if (value.value_type === 'boolean' && value.unit !== null)
			invalid('unit', 'Так/ні не має одиниці вимірювання')
		if (value.value_type === 'enum' && !value.options.length)
			invalid('options', 'Додайте хоча б один варіант')
		if (value.value_type !== 'enum' && value.options.length)
			invalid('options', 'Варіанти доступні лише для списку')
		if (
			value.semantic === 'brand' &&
			value.value_type !== 'string' &&
			value.value_type !== 'enum'
		)
			invalid('semantic', 'Бренд — лише текст або список варіантів')
		// The colour is one dictionary colour per SKU, filtered by its family (owner, 2026-11-06).
		if (
			value.semantic === 'color' &&
			(value.value_type !== 'string' || value.multiple || value.unit !== null)
		)
			invalid('semantic', 'Колір — один колір зі словника для кожного SKU')
		if (value.semantic === 'color' && value.filter_enabled)
			invalid('filter_type', 'Фільтр за кольором вмикається сам')
	})
export const definitionsInputSchema = z
	.array(definitionInputSchema)
	.max(100)
	.superRefine((definitions, ctx) => {
		for (const [semantic, message] of [
			['brand', 'Бренд може бути лише в однієї характеристики категорії'],
			['color', 'Колір може бути лише в однієї характеристики категорії']
		] as const) {
			const marked = definitions.flatMap((definition, index) =>
				definition.semantic === semantic ? [index] : []
			)
			for (const index of marked.slice(1))
				ctx.addIssue({ code: 'custom', path: [index, 'semantic'], message })
		}
	})
/**
 * Whether a characteristic can carry a product's variation — the backend's `isAxisCandidate`
 * (owner, 2026-11-06, as Magento and Akeneo do it): required, one value, a list, a number, yes/no
 * or the colour. Free text would make «63A» and «63 А» two variants.
 */
export const isAxisCandidate = (
	definition: Pick<DefinitionInput, 'is_required' | 'multiple' | 'value_type' | 'semantic'>
) =>
	definition.is_required &&
	!definition.multiple &&
	(['enum', 'number', 'boolean'].includes(definition.value_type) ||
		definition.semantic === 'color')
export type DefinitionInput = z.infer<typeof definitionInputSchema>
export const savedDefinitionSchema = definitionInputSchema.safeExtend({
	key: z.string().min(1),
	options: z.array(z.object({ id: z.string().min(1), label: z.string(), order }))
})
export const configurationSchema = z.object({
	category_id: z.string(),
	revision: order,
	kind: z.enum(['group', 'product']),
	status: z.enum(['draft', 'active', 'archived']),
	definitions: z.array(savedDefinitionSchema),
	controls: z.object({
		fields: z.array(savedDefinitionSchema),
		filters: z.array(savedDefinitionSchema),
		specs: z.array(savedDefinitionSchema),
		variant_axes: z.array(z.string())
	})
})
export type CategoryConfiguration = z.infer<typeof configurationSchema>
const count = z.number().int().nonnegative()
/** Exact per-key usage (Plan-0010 F03): what holds or pins each characteristic. */
export const definitionUsageSchema = z.object({
	category_id: z.string(),
	revision: order,
	published: z.boolean(),
	products: count,
	keys: z.array(
		z.object({
			key: z.string(),
			products: count,
			variants: count,
			landings: count,
			pins: count,
			missing: count,
			options: z.array(
				z.object({ id: z.string(), products: count, variants: count, landings: count })
			)
		})
	)
})
export type DefinitionUsage = z.infer<typeof definitionUsageSchema>
export type KeyUsage = DefinitionUsage['keys'][number]
export const newDefinition = (): DefinitionInput => ({
	label: '',
	value_type: 'string',
	unit: null,
	is_required: false,
	filter_enabled: true,
	filter_type: 'multi-select',
	visible_in_specs: true,
	order: 0,
	multiple: false,
	semantic: 'generic',
	options: []
})
/** Independent copy: preserve labels/rules, never source identities. */
export const copyDefinitions = (definitions: DefinitionInput[]): DefinitionInput[] =>
	definitions.map(({ key: _key, ...definition }) => ({
		...definition,
		options: definition.options.map(({ id: _id, ...option }) => ({ ...option }))
	}))

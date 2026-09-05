import type { Category } from '@/app/admin/categories/categories.schema'

/**
 * `attrKey -> human label`, per category.
 *
 * A landing pins its filters by the derived attribute key (`polymer`, `finish`,
 * `reinforcement`), which is what the catalogue query needs but not what an editor should have
 * to read. The label is already on the category — `required_attributes` is where the admin
 * named the dimension in the first place — so the listing and the filter picker can both speak
 * Ukrainian without a second source of truth.
 */
export const buildAttributeLabels = (categories: Category[]): Map<string, Map<string, string>> =>
	new Map(
		categories.map(category => [
			category._id,
			new Map(category.required_attributes.map(attr => [attr.key, attr.label]))
		])
	)

/** The label if the category knows the key, the raw key otherwise — never an empty chip. */
export const attributeLabel = (
	labels: Map<string, Map<string, string>>,
	categoryId: string,
	key: string
): string => labels.get(categoryId)?.get(key) ?? key

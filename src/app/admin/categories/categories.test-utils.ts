import type { Category, CategoryOption } from './categories.schema'

/**
 * `categoriesApi` for specs (Plan-0010 D06): the select list as `GET /categories/options` gives
 * it, one category with its characteristics as `GET /categories/:id` does.
 */
export const mockCategoriesApi = (categories: Category[]) => ({
	getOptions: () =>
		Promise.resolve(
			categories.map(
				(category): CategoryOption => ({
					_id: category._id,
					name: category.name,
					slug: category.slug,
					kind: 'product',
					attribute_contract_version: 1,
					order: category.order,
					image: category.image,
					attribute_count: category.required_attributes.length
				})
			)
		),
	getById: (id: string) => {
		const category = categories.find(item => item._id === id)
		return category ? Promise.resolve(category) : Promise.reject(Error('404'))
	}
})

import { describe, expect, it } from 'vitest'
import { allowedParents, categoryError, treeRows } from './category-tree.utils'
import type { TreeItem } from './category-tree.api'
const item = (
	id: number,
	parent: number | null = null,
	kind: 'group' | 'product' = 'group'
): TreeItem => ({
	_id: String(id),
	parent_id: parent === null ? null : String(parent),
	kind,
	name: `Category ${id}`,
	slug: `category-${id}`,
	status: 'draft',
	order: id,
	attribute_contract_version: 2
})
describe('category tree workspace', () => {
	it('walks 20,000 levels without a recursive stack or a depth cap', () => {
		const items = Array.from({ length: 20000 }, (_, index) =>
			item(index, index ? index - 1 : null)
		)
		const rows = treeRows(items)
		expect(rows.at(-1)?.depth).toBe(19999)
		expect(treeRows(items, new Set(['2']))).toHaveLength(3)
	})
	it('excludes self, descendants and product categories from parent choices', () => {
		const items = [item(1), item(2, 1), item(3, 2), item(4, null, 'product'), item(5)]
		expect(allowedParents(items, '2').map(row => row._id)).toEqual(['1', '5'])
	})
	it('sorts siblings and rejects orphan/cyclic trees', () => {
		expect(treeRows([item(2), item(1)]).map(row => row.item._id)).toEqual(['1', '2'])
		expect(() => treeRows([item(2, 99)])).toThrow()
		expect(() => treeRows([item(1, 2), item(2, 1)])).toThrow()
	})
})

describe('categoryError', () => {
	const coded = (code: string, status = 409) =>
		categoryError({ status, details: { details: { code } } }).message
	it('asks to publish again when a publication written in parts met new ready products (P13)', () => {
		// The backend publishes a large category in parts; `PUBLICATION_TOO_LARGE` is not sent any more.
		expect(coded('PUBLICATION_CHANGED')).toBe(
			'Поки категорія публікувалася частинами, з’явилися нові готові товари. Опублікуйте її ще раз.'
		)
	})
	it('says the catalogue is busy or the tree is behind, not «check the operation»', () => {
		expect(coded('CATALOG_MAINTENANCE', 503)).toBe(
			'Каталог зараз оновлюється. Спробуйте трохи згодом.'
		)
		expect(coded('CATALOG_READ_CHANGED', 503)).toBe(
			'Каталог змінився під час запиту. Оновіть дерево.'
		)
		expect(coded('CATEGORY_NOT_DRAFT')).toBe('Категорія вже не чернетка. Оновіть дерево.')
		expect(coded('CATEGORY_NOT_ACTIVE')).toBe('Категорія вже не опублікована. Оновіть дерево.')
		expect(coded('CATEGORY_HAS_ACTIVE_CHILDREN')).toBe(
			'Спочатку зніміть з публікації вкладені категорії.'
		)
	})
	it('points at the operation only when its key is kept', () => {
		const unknown = { status: 503, details: { details: { code: 'SOMETHING_NEW' } } }
		// A read, or a refusal that released the key: there is no operation on screen to check.
		expect(categoryError(unknown).message).toBe(
			'Запит не виконано. Оновіть дерево й спробуйте ще раз.'
		)
		expect(categoryError(unknown, true).message).toBe(
			'Результат запиту потребує перевірки. Перевірте стан операції нижче.'
		)
		// A known code keeps its own sentence either way.
		expect(
			categoryError(
				{ status: 503, details: { details: { code: 'CATALOG_WRITE_IN_PROGRESS' } } },
				true
			).message
		).toBe('Каталог зараз оновлюється.')
	})
	it('names the category a name or address collides with (P01)', () => {
		const conflict = (field: 'name' | 'slug') =>
			categoryError({
				status: 409,
				details: {
					details: {
						code: 'CATEGORY_IDENTITY_CONFLICT',
						conflict: {
							field,
							category: { id: 'c1', name: 'Ліхтарі', slug: 'torches' }
						}
					}
				}
			}).message
		expect(conflict('name')).toBe(
			'Назва «Ліхтарі» вже є в іншої категорії (/torches). Оберіть іншу назву.'
		)
		expect(conflict('slug')).toBe(
			'Адреса /torches уже зайнята категорією «Ліхтарі». Оберіть іншу адресу.'
		)
		// An older server without the details still gets the general text.
		expect(
			categoryError({
				status: 409,
				details: { details: { code: 'CATEGORY_IDENTITY_CONFLICT' } }
			}).message
		).toBe('Така назва або адреса вже існує.')
	})
})

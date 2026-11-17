import { describe, expect, it } from 'vitest'
import { buildCatalogTree, findTreeNode, type PublicTreeRow } from './catalog-tree.utils'

const row = (
	id: string,
	parent: string | null,
	kind: 'group' | 'product',
	order = 0
): PublicTreeRow => ({ _id: id, parent_id: parent, kind, name: id, slug: id, order })

describe('buildCatalogTree', () => {
	// root → mid → deep → leaf: five levels, no special code per level.
	const rows = [
		row('root', null, 'group'),
		row('mid', 'root', 'group'),
		row('deep', 'mid', 'group'),
		row('leaf', 'deep', 'product', 1),
		row('empty', 'deep', 'product', 0),
		row('empty-group', 'root', 'group'),
		row('filament', null, 'product', 1)
	]
	const tree = buildCatalogTree(
		rows,
		new Map([
			['leaf', 3],
			['filament', 300]
		])
	)

	it('keeps any depth and sums counts up the branch', () => {
		expect(tree.map(node => [node.slug, node.count])).toEqual([
			['root', 3],
			['filament', 300]
		])
		const deep = findTreeNode(tree, 'deep')!
		expect(deep.children.map(node => node.href)).toEqual(['/leaf'])
	})

	it('prunes branches without an active SKU from navigation', () => {
		expect(findTreeNode(tree, 'empty')).toBeNull()
		expect(findTreeNode(tree, 'empty-group')).toBeNull()
	})

	it('ignores rows whose parent is not public', () => {
		const orphan = buildCatalogTree(
			[row('orphan', 'missing', 'product')],
			new Map([['orphan', 1]])
		)
		expect(orphan).toEqual([])
	})
})

describe('buildCatalogTree at any depth (Plan-0010 D06.5)', () => {
	/** The recursive build it replaced, kept here as the reference. */
	const former = (rows: PublicTreeRow[], counts: Map<string, number>) => {
		const children = new Map<string | null, PublicTreeRow[]>()
		for (const r of rows) children.set(r.parent_id, [...(children.get(r.parent_id) ?? []), r])
		const byOrder = (a: PublicTreeRow, b: PublicTreeRow) =>
			a.order - b.order || a.name.localeCompare(b.name, 'uk') || a._id.localeCompare(b._id)
		const build = (r: PublicTreeRow, path: Set<string>): unknown => {
			if (path.has(r._id)) return null
			const next = new Set(path).add(r._id)
			const nested = (children.get(r._id) ?? [])
				.sort(byOrder)
				.map(child => build(child, next))
				.filter(node => node !== null) as { count: number }[]
			const own = r.kind === 'product' ? (counts.get(r._id) ?? 0) : 0
			const count = own + nested.reduce((sum, node) => sum + node.count, 0)
			if (count === 0) return null
			return {
				id: r._id,
				name: r.name,
				slug: r.slug,
				href: `/${r.slug}`,
				kind: r.kind,
				count,
				children: nested
			}
		}
		return (children.get(null) ?? [])
			.sort(byOrder)
			.map(r => build(r, new Set()))
			.filter(node => node !== null)
	}
	it('builds the same tree as the recursive build on a mixed tree', () => {
		let seed = 7
		const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
		const rows: PublicTreeRow[] = []
		for (let n = 0; n < 400; n++) {
			const groups = rows.filter(r => r.kind === 'group')
			const parent =
				n < 5 || random() < 0.1 ? null : groups[Math.floor(random() * groups.length)]
			rows.push(
				row(
					`n${n}`,
					parent?._id ?? null,
					random() < 0.4 ? 'group' : 'product',
					Math.floor(random() * 3)
				)
			)
		}
		const counts = new Map(
			rows.filter(() => random() < 0.6).map(r => [r._id, Math.floor(random() * 5)])
		)
		expect(buildCatalogTree(rows, counts)).toEqual(former(rows, counts))
	})
	it('builds and searches a 20 000-level chain without exhausting the stack', () => {
		const rows = Array.from({ length: 20_000 }, (_, n) =>
			row(`c${n}`, n === 0 ? null : `c${n - 1}`, n === 19_999 ? 'product' : 'group')
		)
		const tree = buildCatalogTree(rows, new Map([['c19999', 4]]))
		expect(tree).toHaveLength(1)
		expect(findTreeNode(tree, 'c19999')).toMatchObject({ count: 4, children: [] })
		expect(findTreeNode(tree, 'c0')!.count).toBe(4)
	})
})

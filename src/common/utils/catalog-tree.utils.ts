/**
 * The public category tree as the storefront navigates it (TD-0013, Plan-0010 F06).
 *
 * `GET /categories/tree` is flat and already hides draft/archived nodes and everything under
 * them; this module only assembles it and prunes what a shopper should not be sent to: a branch
 * with no active SKU anywhere below it. That is the SEO matrix's «known empty listing» — it still
 * answers 200 (noindex) by its address, but it is not advertised in navigation. Depth is never
 * limited here; presentation decides how much of it to show.
 */
export interface PublicTreeRow {
	_id: string
	parent_id: string | null
	kind: 'group' | 'product'
	name: string
	slug: string
	order: number
}

export interface CatalogTreeNode {
	id: string
	name: string
	slug: string
	href: string
	kind: 'group' | 'product'
	/** Active SKUs in this node and every product category below it. */
	count: number
	children: CatalogTreeNode[]
}

export function buildCatalogTree(
	rows: PublicTreeRow[],
	countsByCategory: Map<string, number>
): CatalogTreeNode[] {
	const children = new Map<string | null, PublicTreeRow[]>()
	for (const row of rows) {
		const siblings = children.get(row.parent_id) ?? []
		siblings.push(row)
		children.set(row.parent_id, siblings)
	}
	for (const siblings of children.values()) siblings.sort(byOrder)
	// Built bottom-up without recursion, so a tree of any depth fits the stack (TD-0013 §6 stress:
	// a 20 000-level chain). A cycle cannot come from the API (the writer refuses it); a node
	// already on the current path is skipped all the same.
	const built = new Map<string, CatalogTreeNode | null>()
	const onPath = new Set<string>()
	const nodeOf = (row: PublicTreeRow): CatalogTreeNode | null => {
		const stack: { row: PublicTreeRow; next: number }[] = [{ row, next: 0 }]
		onPath.add(row._id)
		while (stack.length) {
			const frame = stack[stack.length - 1]
			const kids = children.get(frame.row._id) ?? []
			if (frame.next < kids.length) {
				const child = kids[frame.next++]
				if (!built.has(child._id) && !onPath.has(child._id)) {
					onPath.add(child._id)
					stack.push({ row: child, next: 0 })
				}
				continue
			}
			stack.pop()
			onPath.delete(frame.row._id)
			const nested = kids
				.map(child => built.get(child._id) ?? null)
				.filter((node): node is CatalogTreeNode => node !== null)
			const own =
				frame.row.kind === 'product' ? (countsByCategory.get(frame.row._id) ?? 0) : 0
			const count = own + nested.reduce((sum, node) => sum + node.count, 0)
			built.set(
				frame.row._id,
				count === 0
					? null
					: {
							id: frame.row._id,
							name: frame.row.name,
							slug: frame.row.slug,
							href: `/${frame.row.slug}`,
							kind: frame.row.kind,
							count,
							children: nested
						}
			)
		}
		return built.get(row._id) ?? null
	}
	// Only roots start a branch: a row whose parent is not public has no place in navigation.
	return (children.get(null) ?? [])
		.map(row => nodeOf(row))
		.filter((node): node is CatalogTreeNode => node !== null)
}

const byOrder = (a: PublicTreeRow, b: PublicTreeRow) =>
	a.order - b.order || a.name.localeCompare(b.name, 'uk') || a._id.localeCompare(b._id)

/** The subtree under `id`, or `null` when the node is not reachable in the public tree. */
export function findTreeNode(tree: CatalogTreeNode[], id: string): CatalogTreeNode | null {
	// Depth first in the same order as before, without recursion (any depth fits the stack).
	const stack = [...tree].reverse()
	while (stack.length) {
		const node = stack.pop()!
		if (node.id === id) return node
		for (let index = node.children.length - 1; index >= 0; index--)
			stack.push(node.children[index])
	}
	return null
}

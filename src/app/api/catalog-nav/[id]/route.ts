import { NextResponse } from 'next/server'
import { loadCatalogTree } from '@/common/utils/catalog-tree.server'
import { findTreeNode } from '@/common/utils/catalog-tree.utils'
import { navLevel } from '@/common/utils/navigation.utils'

/**
 * `GET /api/catalog-nav/<category id>` — one level of a large catalogue's menu (Plan-0010 D06.5):
 * the non-empty sub-categories of a branch the server HTML did not list, from the same cached
 * tree the header is built from (`loadCatalogTree`, Data Cache tags `categories`/`products`).
 * An upstream failure is a 503 the browser does not keep: the menu shows its error and reads the
 * branch again when it is reopened.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ links: [] }, { status: 404 })
	let tree: Awaited<ReturnType<typeof loadCatalogTree>>
	try {
		tree = await loadCatalogTree()
	} catch {
		return NextResponse.json(
			{ links: [] },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		)
	}
	const node = findTreeNode(tree, id)
	if (!node) return NextResponse.json({ links: [] }, { status: 404 })
	const level = navLevel(node.children)
	return NextResponse.json({ links: level.children ?? [], more: level.more ?? 0 })
}

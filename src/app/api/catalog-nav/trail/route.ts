import { NextResponse } from 'next/server'
import { loadCatalogTree } from '@/common/utils/catalog-tree.server'
import type { CatalogTreeNode } from '@/common/utils/catalog-tree.utils'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Root-first addresses down to the node with this slug, or null when the tree has none. */
function trailOf(nodes: CatalogTreeNode[], slug: string): string[] | null {
	for (const node of nodes) {
		if (node.slug === slug) return [node.href]
		const below = trailOf(node.children, slug)
		if (below) return [node.href, ...below]
	}
	return null
}

/**
 * `GET /api/catalog-nav/trail?slug=<category slug>` — where a category sits in the public tree
 * (P09, owner decision 02.11.2026): the addresses from its root down to it. A large catalogue's
 * header carries two levels only (D06.5), so a deeper page cannot tell from the HTML that it is
 * inside «Каталог» or which mobile branches to open; this answers it from the same cached tree.
 * Not a category — 404; the tree unreadable — a 503 the browser does not keep.
 */
export async function GET(request: Request) {
	const slug = new URL(request.url).searchParams.get('slug') ?? ''
	if (!SLUG.test(slug)) return NextResponse.json({ hrefs: [] }, { status: 404 })
	let tree: Awaited<ReturnType<typeof loadCatalogTree>>
	try {
		tree = await loadCatalogTree()
	} catch {
		return NextResponse.json(
			{ hrefs: [] },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		)
	}
	const hrefs = trailOf(tree, slug)
	return hrefs ? NextResponse.json({ hrefs }) : NextResponse.json({ hrefs: [] }, { status: 404 })
}

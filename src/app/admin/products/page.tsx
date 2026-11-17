import { ProductWorkspaceGate } from './ProductWorkspaceGate'
import { Products } from './Products'

/** `?category=<id>` opens the products of that category (the category page links here). */
export default async function ProductsPage({
	searchParams
}: {
	searchParams: Promise<{ category?: string | string[] }>
}) {
	const { category } = await searchParams
	const categoryId =
		typeof category === 'string' && /^[a-f0-9]{24}$/.test(category) ? category : undefined
	return (
		<ProductWorkspaceGate categoryId={categoryId}>
			<Products />
		</ProductWorkspaceGate>
	)
}

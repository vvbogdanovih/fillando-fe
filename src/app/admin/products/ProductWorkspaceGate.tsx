'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { categoryTreeApi } from '../categories/category-tree.api'
import { CategoryTreeWorkspace } from '../categories/_components/CategoryTreeWorkspace'
export function ProductWorkspaceGate({
	children,
	productId,
	categoryId
}: {
	children: ReactNode
	productId?: string
	/** The category whose products the view opens on (from the category page's link). */
	categoryId?: string
}) {
	const capability = useQuery({
		queryKey: ['category-tree-capabilities'],
		queryFn: categoryTreeApi.capabilities,
		retry: false
	})
	const product = useQuery({
		queryKey: ['typed-product-entry', productId],
		enabled: !!productId && capability.data?.legacy_writes_enabled === false,
		queryFn: () => categoryTreeApi.typedProduct(productId!),
		retry: false
	})
	// Only while the mode was never read. The workspace re-reads the capabilities after every
	// command under this same key: one failed re-read must not take the screen — and the unsaved
	// edits it holds — away; the mode already known stands.
	if (capability.isError && !capability.data)
		return (
			<p role='alert' className='p-4'>
				Не вдалося перевірити режим каталогу. Оновіть сторінку.
			</p>
		)
	if (!capability.data) return <p className='p-4'>Завантаження каталогу…</p>
	if (capability.data.legacy_writes_enabled) return <>{children}</>
	if (productId && product.isError)
		return (
			<div className='space-y-3 p-4'>
				<p role='alert'>
					Цей товар недоступний у новому редакторі: він може потребувати перенесення або
					каталог зараз оновлюється.
				</p>
				<Link href='/admin/products' className='underline'>
					До товарів нового каталогу
				</Link>
			</div>
		)
	if (productId && !product.data) return <p className='p-4'>Завантаження товару…</p>
	return (
		<CategoryTreeWorkspace
			productsOnly
			initialCategoryId={product.data?.category_id ?? categoryId}
			initialProductId={productId}
		/>
	)
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { UI_URLS } from '@/common/constants'
import { formatUah } from '@/common/utils/price.utils'
import type { TopProduct } from './analytics.schema'

interface TopProductsTableProps {
	byRevenue: TopProduct[]
	byQuantity: TopProduct[]
}

type Ranking = 'revenue' | 'quantity'

/** Top variants of the period; line values before coupons, like the sales report's table. */
export const TopProductsTable = ({ byRevenue, byQuantity }: TopProductsTableProps) => {
	const [ranking, setRanking] = useState<Ranking>('revenue')
	const rows = ranking === 'revenue' ? byRevenue : byQuantity

	return (
		<Card>
			<CardHeader className='flex flex-row flex-wrap items-center justify-between gap-3 space-y-0'>
				<div>
					<CardTitle className='text-base'>Топ товарів</CardTitle>
					<p className='text-sm text-gray-500'>
						Без скасованих замовлень; суми до купонів.
					</p>
				</div>
				<div className='flex gap-1' role='group' aria-label='Сортування'>
					<Button
						size='sm'
						variant={ranking === 'revenue' ? 'default' : 'outline'}
						aria-pressed={ranking === 'revenue'}
						onClick={() => setRanking('revenue')}
					>
						За виручкою
					</Button>
					<Button
						size='sm'
						variant={ranking === 'quantity' ? 'default' : 'outline'}
						aria-pressed={ranking === 'quantity'}
						onClick={() => setRanking('quantity')}
					>
						За кількістю
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className='text-sm text-gray-500'>За період нічого не продано.</p>
				) : (
					<div className='overflow-auto'>
						<table className='w-full min-w-[560px] text-sm'>
							<thead className='text-left text-gray-500'>
								<tr>
									<th className='py-1 pr-3 font-medium'>#</th>
									<th className='py-1 pr-3 font-medium'>SKU</th>
									<th className='py-1 pr-3 font-medium'>Товар</th>
									<th className='py-1 pr-3 text-right font-medium'>К-сть</th>
									<th className='py-1 pr-3 text-right font-medium'>Замовлень</th>
									<th className='py-1 text-right font-medium'>Сума</th>
								</tr>
							</thead>
							<tbody className='tabular-nums'>
								{rows.map((row, index) => (
									<tr
										key={row.variant_id ?? row.sku}
										className='border-t border-gray-100'
									>
										<td className='py-1.5 pr-3 text-gray-500'>{index + 1}</td>
										<td className='py-1.5 pr-3 font-mono text-xs text-gray-600'>
											{row.sku}
										</td>
										<td className='py-1.5 pr-3'>
											{row.product_id ? (
												<Link
													href={UI_URLS.ADMIN.EDIT_PRODUCT(
														row.product_id
													)}
													className='text-gray-900 underline-offset-2 hover:underline'
												>
													{row.name}
												</Link>
											) : (
												<span className='text-gray-900'>{row.name}</span>
											)}
										</td>
										<td className='py-1.5 pr-3 text-right'>{row.quantity}</td>
										<td className='py-1.5 pr-3 text-right'>{row.orders}</td>
										<td className='py-1.5 text-right'>
											{formatUah(row.revenue)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

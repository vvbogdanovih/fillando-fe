import Image from 'next/image'
import type { OrderItem } from './orders.schema'
import { formatPrice } from './orders.utils'

/**
 * What the catalogue holds of an ordered SKU right now. An order reserves nothing, so a line
 * confirmed days after checkout may no longer be there — red when the stock does not cover it.
 */
function StockNow({ item }: { item: OrderItem }) {
	if (item.stock_now === undefined) return null
	if (item.stock_now === null) {
		return <p className='text-destructive text-xs'>Товару вже немає в каталозі</p>
	}
	const enough = item.stock_now >= item.quantity
	return (
		<p
			className={
				enough ? 'text-muted-foreground text-xs' : 'text-destructive text-xs font-medium'
			}
		>
			Зараз у наявності: {item.stock_now}
			{enough ? '' : ' — не вистачає'}
		</p>
	)
}

export function OrderItemsList({ items }: { items: OrderItem[] }) {
	if (items.length === 0) {
		return <p className='text-muted-foreground text-sm'>Товари відсутні</p>
	}

	return (
		<>
			{items.map(item => (
				<div
					key={`${item.variant_id}-${item.sku}-${item.name}`}
					className='flex items-center gap-2 rounded-md border p-2 sm:gap-3 sm:p-3'
				>
					{item.image ? (
						<Image
							src={item.image}
							alt={item.name}
							width={64}
							height={64}
							className='h-12 w-12 rounded object-cover sm:h-16 sm:w-16'
						/>
					) : (
						<div className='h-12 w-12 rounded bg-gray-100 sm:h-16 sm:w-16' />
					)}
					<div className='min-w-0 flex-1'>
						<p className='line-clamp-2 text-sm font-medium sm:line-clamp-1 sm:text-base'>
							{item.name}
						</p>
						<p className='text-muted-foreground text-xs'>
							SKU: {item.sku ?? '—'} • Vendor SKU: {item.vendor_sku ?? '—'}
						</p>
					</div>
					<div className='text-right text-sm'>
						<p>К-сть: {item.quantity}</p>
						<StockNow item={item} />
						<p className='font-medium'>{formatPrice(item.line_total)}</p>
					</div>
				</div>
			))}
		</>
	)
}

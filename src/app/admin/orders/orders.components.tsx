import Image from 'next/image'
import type { OrderItem } from './orders.schema'
import { formatPrice } from './orders.utils'

export function OrderItemsList({ items }: { items: OrderItem[] }) {
	if (items.length === 0) {
		return <p className='text-muted-foreground text-sm'>Товари відсутні</p>
	}

	return (
		<>
			{items.map(item => (
				<div key={`${item.variant_id}-${item.sku}-${item.name}`} className='flex items-center gap-3 rounded-md border p-3'>
					{item.image ? (
						<Image
							src={item.image}
							alt={item.name}
							width={64}
							height={64}
							className='h-16 w-16 rounded object-cover'
						/>
					) : (
						<div className='h-16 w-16 rounded bg-gray-100' />
					)}
					<div className='min-w-0 flex-1'>
						<p className='line-clamp-1 font-medium'>{item.name}</p>
						<p className='text-muted-foreground text-xs'>
							SKU: {item.sku ?? '—'} • Vendor SKU: {item.vendor_sku ?? '—'}
						</p>
					</div>
					<div className='text-right text-sm'>
						<p>К-сть: {item.quantity}</p>
						<p className='font-medium'>{formatPrice(item.line_total)}</p>
					</div>
				</div>
			))}
		</>
	)
}

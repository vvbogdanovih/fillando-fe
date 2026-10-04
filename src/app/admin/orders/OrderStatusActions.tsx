'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@/common/components/ui/dropdown-menu'
import { ORDER_STATUS_LABELS } from './orders.constants'
import { orderStatusValues, type Order, type OrderStatus } from './orders.schema'

/**
 * The order-status dropdown. Every status is listed so the admin sees the whole path, but only
 * the moves the backend allows from the current status (`allowed_status_transitions`, TD-0011)
 * are enabled — the rule lives on the server, this only reflects it. SHIPPED is always greyed
 * (entering a TTN ships the order) and so is COMPLETED (a paid delivery settles there by itself).
 * A backend that sends no list at all (an older build) does not restrict the dropdown.
 */
export function OrderStatusActions({
	order,
	onTransition,
	isPending
}: {
	order: Order
	onTransition: (to: OrderStatus) => void
	isPending: boolean
}) {
	const allowed = order.allowed_status_transitions
	const isEnabled = (status: OrderStatus) =>
		status === order.order_status || allowed === undefined || allowed.includes(status)

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' className='w-full justify-between' disabled={isPending}>
					{ORDER_STATUS_LABELS[order.order_status]}
					<ChevronDown className='ml-2 size-4 opacity-50' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-60'>
				<DropdownMenuRadioGroup
					value={order.order_status}
					onValueChange={value => {
						if (value !== order.order_status) onTransition(value as OrderStatus)
					}}
				>
					{orderStatusValues.map(status => (
						<DropdownMenuRadioItem
							key={status}
							value={status}
							disabled={!isEnabled(status)}
						>
							{ORDER_STATUS_LABELS[status]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

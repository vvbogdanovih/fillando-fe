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
 *
 * The line under it says why those two are grey: the owner's first instinct on a pickup order
 * was that «Виконано» needed a TTN, when it needs «Доставлено» (the handover) plus «Оплачено».
 */
const OPEN_STATUSES: readonly OrderStatus[] = [
	'NEW',
	'PROCESSING',
	'CONFIRMED',
	'SHIPPED',
	'DELIVERED'
]
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

	const hint = OPEN_STATUSES.includes(order.order_status)
		? order.delivery_method === 'PICKUP'
			? '«Виконано» ставиться автоматично: «Доставлено» (видано клієнту) + «Оплачено». ТТН для самовивозу не потрібна — але якщо ви її внесете, замовлення піде як відправлене.'
			: '«Виконано» ставиться автоматично: «Доставлено» (Нова Пошта або вручну) + «Оплачено». «Відправлено» ставить збережена ТТН.'
		: null

	return (
		<div className='space-y-1.5'>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant='outline'
						className='w-full justify-between'
						disabled={isPending}
					>
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
			{hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
		</div>
	)
}

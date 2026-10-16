'use client'

import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { ordersApi } from './orders.api'
import type { OrderStatus, PaymentStatus } from './orders.schema'
import { formatAwaitingTtnList } from './orders.utils'

interface CopyAwaitingTtnButtonProps {
	orderStatus: 'all' | OrderStatus
	paymentStatus: 'all' | PaymentStatus
}

/**
 * Copies «number + phone» of every order that still needs a TTN — no TTN, not a pickup, not
 * cancelled or returned — to the clipboard, across every page of the current filter. The
 * owner pastes it to whoever books the shipments; see `formatAwaitingTtnList`.
 */
export function CopyAwaitingTtnButton({ orderStatus, paymentStatus }: CopyAwaitingTtnButtonProps) {
	const copyMutation = useMutation({
		mutationFn: async () => {
			const orders = await ordersApi.getAllPages({
				order_status: orderStatus === 'all' ? undefined : orderStatus,
				payment_status: paymentStatus === 'all' ? undefined : paymentStatus
			})
			const text = formatAwaitingTtnList(orders)
			if (!text) return 0
			if (!navigator.clipboard) throw new Error('clipboard unavailable')
			await navigator.clipboard.writeText(text)
			return text.split('\n\n').length
		},
		onSuccess: count => {
			if (count === 0) toast('Немає замовлень без ТТН')
			else toast.success(`Скопійовано замовлень без ТТН: ${count}`)
		},
		onError: () => {
			toast.error('Не вдалося скопіювати список')
		}
	})

	return (
		<Button
			size='sm'
			variant='outline'
			onClick={() => copyMutation.mutate()}
			disabled={copyMutation.isPending}
			title='Скопіювати номери й телефони замовлень без ТТН (крім самовивозу)'
		>
			<ClipboardList className='size-4 sm:mr-2' />
			<span className='hidden sm:inline'>
				{copyMutation.isPending ? 'Збираємо…' : 'Скопіювати'}
			</span>
		</Button>
	)
}

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { ordersApi } from './orders.api'
import { formatPrice } from './orders.utils'
import type { Order } from './orders.schema'

/** Once the money has moved a discount is a refund — the backend refuses it with a 409. */
const LOCKED_PAYMENT_STATUSES: Order['payment_status'][] = ['PAID', 'REFUNDED']

export function ManualDiscountCard({
	order,
	onUpdated
}: {
	order: Order
	onUpdated: (updated: Order) => void
}) {
	const current = order.manual_discount ?? null
	const [amount, setAmount] = useState('')
	const [reason, setReason] = useState('')
	const locked = LOCKED_PAYMENT_STATUSES.includes(order.payment_status)
	const payable = order.total_price + (current?.amount ?? 0)

	const mutation = useMutation({
		mutationFn: (manual_discount: { amount: number; reason: string } | null) =>
			ordersApi.patchOrder(order.id, { manual_discount }),
		// The refusals (paid order, open LiqPay session, amount too large) come in Ukrainian, so
		// they are shown as is: `mapOrderErrorMessage` would rewrite «Знижка 400 ₴…» as a 400.
		onError: (error: Error) => toast.error(error.message || 'Не вдалося змінити знижку'),
		onSuccess: (updated, manual_discount) => {
			onUpdated(updated)
			setAmount('')
			setReason('')
			toast.success(manual_discount ? 'Знижку застосовано' : 'Знижку прибрано')
		}
	})

	const parsedAmount = Number(amount.trim().replace(',', '.'))
	const amountValid =
		/^\d+([.,]\d{1,2})?$/.test(amount.trim()) && parsedAmount > 0 && parsedAmount <= payable
	const canApply = !locked && amountValid && reason.trim() !== '' && !mutation.isPending

	return (
		<Card>
			<CardHeader>
				<CardTitle>Знижка магазину</CardTitle>
			</CardHeader>
			<CardContent className='space-y-3 text-sm'>
				{current ? (
					<div className='flex flex-wrap items-center justify-between gap-2'>
						<p>
							Діє знижка <strong>-{formatPrice(current.amount)}</strong>
							{current.reason ? (
								<span className='text-muted-foreground'> — {current.reason}</span>
							) : null}
						</p>
						<Button
							variant='outline'
							disabled={locked || mutation.isPending}
							onClick={() => mutation.mutate(null)}
						>
							Прибрати
						</Button>
					</div>
				) : null}

				{locked ? (
					<p className='text-xs text-amber-700'>
						Замовлення вже оплачене — знижку можна оформити лише як повернення коштів.
					</p>
				) : (
					<>
						<div className='grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end'>
							<div className='space-y-2'>
								<Label htmlFor='manual-discount-amount'>Сума, ₴</Label>
								<Input
									id='manual-discount-amount'
									inputMode='decimal'
									value={amount}
									onChange={e => setAmount(e.target.value)}
									placeholder='50'
								/>
							</div>
							<div className='space-y-2'>
								<Label htmlFor='manual-discount-reason'>Причина</Label>
								<Input
									id='manual-discount-reason'
									value={reason}
									maxLength={300}
									onChange={e => setReason(e.target.value)}
									placeholder='Клієнт попросив знижку по телефону'
								/>
							</div>
							<Button
								disabled={!canApply}
								onClick={() =>
									mutation.mutate({ amount: parsedAmount, reason: reason.trim() })
								}
							>
								{current ? 'Замінити' : 'Застосувати'}
							</Button>
						</div>
						<p className='text-muted-foreground text-xs'>
							Віднімається від суми після купона (до {formatPrice(payable)}). Причину
							бачите лише ви — покупцю показується тільки сума. Для накладного платежу
							вкажіть нову суму в ТТН у кабінеті Нової Пошти.
						</p>
					</>
				)}
			</CardContent>
		</Card>
	)
}

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/common/components/ui/dialog'
import { Label } from '@/common/components/ui/label'
import { Input } from '@/common/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { ordersApi } from './orders.api'
import {
	orderStatusValues,
	paymentStatusValues,
	type OrderStatus,
	type PaymentStatus,
	type GenerateReportPayload
} from './orders.schema'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './orders.constants'

export function ReportModal() {
	const [open, setOpen] = useState(false)
	const [dateFrom, setDateFrom] = useState('')
	const [dateTo, setDateTo] = useState('')
	const [orderStatus, setOrderStatus] = useState<'all' | OrderStatus>('all')
	const [paymentStatus, setPaymentStatus] = useState<'all' | PaymentStatus>('all')

	const isValid = dateFrom && dateTo && dateFrom <= dateTo

	const reportMutation = useMutation({
		mutationFn: () => {
			const payload: GenerateReportPayload = {
				date_from: dateFrom,
				date_to: dateTo
			}
			if (orderStatus !== 'all') payload.order_status = orderStatus
			if (paymentStatus !== 'all') payload.payment_status = paymentStatus
			return ordersApi.downloadReport(payload)
		},
		onSuccess: () => {
			toast.success('Звіт завантажено')
			setOpen(false)
		},
		onError: () => {
			toast.error('Не вдалося згенерувати звіт')
		}
	})

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setDateFrom('')
			setDateTo('')
			setOrderStatus('all')
			setPaymentStatus('all')
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size='sm' variant='outline'>
					<FileSpreadsheet className='size-4 sm:mr-2' />
					<span className='hidden sm:inline'>Звіт</span>
				</Button>
			</DialogTrigger>
			<DialogContent className='max-w-md'>
				<DialogHeader>
					<DialogTitle>Генерація звіту</DialogTitle>
					<DialogDescription>
						Оберіть період та фільтри для генерації PDF звіту з інвойсами замовлень.
					</DialogDescription>
				</DialogHeader>
				<div className='grid gap-4'>
					<div className='grid grid-cols-2 gap-3'>
						<div className='space-y-2'>
							<Label>Дата від</Label>
							<Input
								type='date'
								value={dateFrom}
								onChange={e => setDateFrom(e.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Дата до</Label>
							<Input
								type='date'
								value={dateTo}
								onChange={e => setDateTo(e.target.value)}
							/>
						</div>
					</div>
					<div className='grid grid-cols-2 gap-3'>
						<div className='space-y-2'>
							<Label>Статус замовлення</Label>
							<Select
								value={orderStatus}
								onValueChange={v => setOrderStatus(v as 'all' | OrderStatus)}
							>
								<SelectTrigger className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>Всі</SelectItem>
									{orderStatusValues.map(val => (
										<SelectItem key={val} value={val}>
											{ORDER_STATUS_LABELS[val]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label>Статус оплати</Label>
							<Select
								value={paymentStatus}
								onValueChange={v => setPaymentStatus(v as 'all' | PaymentStatus)}
							>
								<SelectTrigger className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>Всі</SelectItem>
									{paymentStatusValues.map(val => (
										<SelectItem key={val} value={val}>
											{PAYMENT_STATUS_LABELS[val]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
						className='bg-primary text-black hover:bg-primary/80'
						onClick={() => reportMutation.mutate()}
						disabled={!isValid || reportMutation.isPending}
					>
						{reportMutation.isPending ? 'Генерація...' : 'Завантажити'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

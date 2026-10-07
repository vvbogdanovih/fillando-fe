'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Checkbox } from '@/common/components/ui/checkbox'
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
import { ordersApi } from './orders.api'
import {
	orderStatusValues,
	paymentStatusValues,
	type OrderStatus,
	type PaymentStatus,
	type GenerateReportPayload
} from './orders.schema'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './orders.constants'

/**
 * What finance asks for most of the time: the orders that were handed over and paid.
 * Everything else is one tick away.
 */
export const DEFAULT_REPORT_ORDER_STATUSES: readonly OrderStatus[] = ['COMPLETED']
export const DEFAULT_REPORT_PAYMENT_STATUSES: readonly PaymentStatus[] = ['PAID']

/** The filter the request carries: the full set is no filter at all, so it is left out. */
export function reportStatusFilter<T extends string>(
	selected: readonly T[],
	all: readonly T[]
): T[] | undefined {
	return selected.length === all.length ? undefined : all.filter(v => selected.includes(v))
}

interface StatusChecklistProps<T extends string> {
	id: string
	label: string
	values: readonly T[]
	labels: Record<T, string>
	selected: readonly T[]
	onChange: (next: T[]) => void
}

function StatusChecklist<T extends string>({
	id,
	label,
	values,
	labels,
	selected,
	onChange
}: StatusChecklistProps<T>) {
	const allSelected = selected.length === values.length
	const noneSelected = selected.length === 0
	const toggle = (value: T) =>
		onChange(
			selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
		)

	return (
		<div className='space-y-2'>
			<Label>{label}</Label>
			<div className='max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-3'>
				<div className='mb-1 flex items-center gap-2 border-b pb-2'>
					<Checkbox
						id={`${id}-all`}
						checked={allSelected ? true : noneSelected ? false : 'indeterminate'}
						onCheckedChange={() => onChange(allSelected ? [] : [...values])}
					/>
					<Label htmlFor={`${id}-all`} className='cursor-pointer text-sm font-normal'>
						Обрати все
					</Label>
				</div>
				{values.map(value => (
					<div key={value} className='flex items-center gap-2'>
						<Checkbox
							id={`${id}-${value}`}
							checked={selected.includes(value)}
							onCheckedChange={() => toggle(value)}
						/>
						<Label
							htmlFor={`${id}-${value}`}
							className='cursor-pointer text-sm font-normal'
						>
							{labels[value]}
						</Label>
					</div>
				))}
			</div>
			{noneSelected && <p className='text-destructive text-xs'>Оберіть хоча б один статус</p>}
		</div>
	)
}

export function ReportModal() {
	const [open, setOpen] = useState(false)
	const [dateFrom, setDateFrom] = useState('')
	const [dateTo, setDateTo] = useState('')
	const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([
		...DEFAULT_REPORT_ORDER_STATUSES
	])
	const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[]>([
		...DEFAULT_REPORT_PAYMENT_STATUSES
	])

	// Nothing ticked in a group is an empty report, so it never leaves the form.
	const isValid =
		dateFrom &&
		dateTo &&
		dateFrom <= dateTo &&
		orderStatuses.length > 0 &&
		paymentStatuses.length > 0

	const reportMutation = useMutation({
		mutationFn: () => {
			const payload: GenerateReportPayload = {
				date_from: dateFrom,
				date_to: dateTo
			}
			const orderFilter = reportStatusFilter(orderStatuses, orderStatusValues)
			const paymentFilter = reportStatusFilter(paymentStatuses, paymentStatusValues)
			if (orderFilter) payload.order_status = orderFilter
			if (paymentFilter) payload.payment_status = paymentFilter
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
			setOrderStatuses([...DEFAULT_REPORT_ORDER_STATUSES])
			setPaymentStatuses([...DEFAULT_REPORT_PAYMENT_STATUSES])
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
					<DialogTitle>Звіт про продажі</DialogTitle>
					<DialogDescription>
						PDF для фінансового відділу: продані товари за період, реєстр замовлень і
						підсумки. Дати — київські календарні дні, за датою оформлення замовлення.
					</DialogDescription>
				</DialogHeader>
				<div className='grid gap-4'>
					<div className='grid grid-cols-2 gap-3'>
						<div className='space-y-2'>
							<Label htmlFor='report-date-from'>Дата від</Label>
							<Input
								id='report-date-from'
								type='date'
								value={dateFrom}
								onChange={e => setDateFrom(e.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='report-date-to'>Дата до</Label>
							<Input
								id='report-date-to'
								type='date'
								value={dateTo}
								onChange={e => setDateTo(e.target.value)}
							/>
						</div>
					</div>
					<div className='grid grid-cols-2 gap-3'>
						<StatusChecklist
							id='report-order-status'
							label='Статус замовлення'
							values={orderStatusValues}
							labels={ORDER_STATUS_LABELS}
							selected={orderStatuses}
							onChange={setOrderStatuses}
						/>
						<StatusChecklist
							id='report-payment-status'
							label='Статус оплати'
							values={paymentStatusValues}
							labels={PAYMENT_STATUS_LABELS}
							selected={paymentStatuses}
							onChange={setPaymentStatuses}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
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

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText } from 'lucide-react'
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
import { Textarea } from '@/common/components/ui/textarea'
import { Label } from '@/common/components/ui/label'
import { ordersApi } from './orders.api'
import type { InvoiceAudience } from './orders.schema'

const AUDIENCE_OPTIONS: { value: InvoiceAudience; label: string; hint: string }[] = [
	{ value: 'customer', label: 'Для клієнта', hint: 'Без артикулу постачальника (Vendor SKU)' },
	{
		value: 'internal',
		label: 'Внутрішній',
		hint: 'З артикулом постачальника — не пересилати клієнту'
	}
]

export function InvoiceModal({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
	const [open, setOpen] = useState(false)
	const [adminComment, setAdminComment] = useState('')
	// Defaults to the copy that is safe to hand to a buyer; the internal one is an explicit choice.
	const [audience, setAudience] = useState<InvoiceAudience>('customer')

	const invoiceMutation = useMutation({
		mutationFn: () => ordersApi.downloadInvoice(orderId, orderNumber, adminComment, audience),
		onSuccess: () => {
			toast.success('Інвойс завантажено')
			setOpen(false)
			setAdminComment('')
			setAudience('customer')
		},
		onError: () => {
			toast.error('Не вдалося згенерувати інвойс')
		}
	})

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setAdminComment('')
			setAudience('customer')
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size='sm'>
					<FileText className='size-4 sm:mr-2' />
					<span className='hidden sm:inline'>Завантажити інвойс</span>
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Генерація інвойсу</DialogTitle>
					<DialogDescription>
						Додайте необов'язковий коментар, який буде включено в PDF інвойс.
					</DialogDescription>
				</DialogHeader>
				<div className='space-y-2'>
					<Label id='invoice-audience-label'>Для кого</Label>
					<div
						role='radiogroup'
						aria-labelledby='invoice-audience-label'
						className='grid grid-cols-2 gap-2'
					>
						{AUDIENCE_OPTIONS.map(option => (
							<Button
								key={option.value}
								type='button'
								role='radio'
								aria-checked={audience === option.value}
								variant={audience === option.value ? 'default' : 'outline'}
								onClick={() => setAudience(option.value)}
							>
								{option.label}
							</Button>
						))}
					</div>
					<p className='text-muted-foreground text-xs'>
						{AUDIENCE_OPTIONS.find(option => option.value === audience)?.hint}
					</p>
				</div>
				<div className='space-y-2'>
					<Label htmlFor='admin-comment'>Коментар до інвойсу</Label>
					<Textarea
						id='admin-comment'
						placeholder="Необов'язковий коментар адміністратора..."
						value={adminComment}
						onChange={e => setAdminComment(e.target.value)}
						maxLength={1000}
					/>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
						onClick={() => invoiceMutation.mutate()}
						disabled={invoiceMutation.isPending}
					>
						{invoiceMutation.isPending ? 'Генерація...' : 'Згенерувати'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

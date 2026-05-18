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

export function InvoiceModal({
	orderId,
	orderNumber
}: {
	orderId: string
	orderNumber: string
}) {
	const [open, setOpen] = useState(false)
	const [adminComment, setAdminComment] = useState('')

	const invoiceMutation = useMutation({
		mutationFn: () => ordersApi.downloadInvoice(orderId, orderNumber, adminComment),
		onSuccess: () => {
			toast.success('Інвойс завантажено')
			setOpen(false)
			setAdminComment('')
		},
		onError: () => {
			toast.error('Не вдалося згенерувати інвойс')
		}
	})

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setAdminComment('')
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size='sm' className='bg-primary text-black hover:bg-primary/80'>
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
						className='bg-primary text-black hover:bg-primary/80'
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

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { Label } from '@/common/components/ui/label'
import { Textarea } from '@/common/components/ui/textarea'
import { ordersApi } from './orders.api'

const VENDOR_EMAILS = ['andriy090@gmail.com', 'vvbogdanovih@gmail.com'] as const

interface VendorEmailModalProps {
	orderId: string
}

export function VendorEmailModal({ orderId }: VendorEmailModalProps) {
	const [open, setOpen] = useState(false)
	const [selectedEmail, setSelectedEmail] = useState<string>('')
	const [adminComment, setAdminComment] = useState('')

	const resetForm = () => {
		setSelectedEmail('')
		setAdminComment('')
	}

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) resetForm()
	}

	const sendMutation = useMutation({
		mutationFn: () =>
			ordersApi.sendVendorEmail(orderId, {
				vendor_email: selectedEmail,
				admin_comment: adminComment.trim() || undefined
			}),
		onSuccess: () => {
			toast.success('Лист відправлено')
			setOpen(false)
			resetForm()
		},
		onError: () => {
			toast.error('Не вдалося відправити лист')
		}
	})

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size='sm' className='bg-primary text-black hover:bg-primary/80'>
					<Mail className='size-3.5' />
					Написати вендору
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Написати вендору</DialogTitle>
					<DialogDescription>
						Вендор отримає інвойс замовлення на email.
					</DialogDescription>
				</DialogHeader>
				<div className='space-y-4'>
					<div className='space-y-2'>
						<Label>Email вендора</Label>
						<Select value={selectedEmail} onValueChange={setSelectedEmail}>
							<SelectTrigger className='w-full'>
								<SelectValue placeholder='Оберіть email' />
							</SelectTrigger>
							<SelectContent>
								{VENDOR_EMAILS.map(email => (
									<SelectItem key={email} value={email}>
										{email}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='space-y-2'>
						<Label>Коментар до інвойсу</Label>
						<Textarea
							value={adminComment}
							onChange={e => setAdminComment(e.target.value)}
							placeholder="Необов'язковий коментар адміна"
							rows={3}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
						className='bg-primary text-black hover:bg-primary/80'
						onClick={() => sendMutation.mutate()}
						disabled={!selectedEmail || sendMutation.isPending}
					>
						{sendMutation.isPending ? 'Відправка...' : 'Відправити'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

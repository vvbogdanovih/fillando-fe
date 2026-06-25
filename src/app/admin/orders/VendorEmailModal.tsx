'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, Paperclip, X } from 'lucide-react'
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

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			resolve(result.split(',')[1])
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

export function VendorEmailModal({ orderId }: VendorEmailModalProps) {
	const [open, setOpen] = useState(false)
	const [selectedEmail, setSelectedEmail] = useState<string>('')
	const [adminComment, setAdminComment] = useState('')
	const [files, setFiles] = useState<File[]>([])
	const fileInputRef = useRef<HTMLInputElement>(null)

	const resetForm = () => {
		setSelectedEmail('')
		setAdminComment('')
		setFiles([])
		if (fileInputRef.current) fileInputRef.current.value = ''
	}

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) resetForm()
	}

	const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			setFiles(prev => [...prev, ...Array.from(e.target.files!)])
		}
		if (fileInputRef.current) fileInputRef.current.value = ''
	}

	const removeFile = (index: number) => {
		setFiles(prev => prev.filter((_, i) => i !== index))
	}

	const sendMutation = useMutation({
		mutationFn: async () => {
			let attachments: { filename: string; content: string }[] | undefined

			if (files.length > 0) {
				attachments = await Promise.all(
					files.map(async file => ({
						filename: file.name,
						content: await fileToBase64(file)
					}))
				)
			}

			return ordersApi.sendVendorEmail(orderId, {
				vendor_email: selectedEmail,
				admin_comment: adminComment.trim() || undefined,
				attachments
			})
		},
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
				<Button size='sm' className='bg-primary hover:bg-primary/80 text-black'>
					<Mail className='size-3.5' />
					<span className='hidden sm:inline'>Написати вендору</span>
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
					<div className='space-y-2'>
						<Label>Вкладення</Label>
						<input
							ref={fileInputRef}
							type='file'
							multiple
							className='hidden'
							onChange={handleFilesSelected}
						/>
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={() => fileInputRef.current?.click()}
						>
							<Paperclip className='size-3.5' />
							Прикріпити файл
						</Button>
						{files.length > 0 && (
							<ul className='space-y-1'>
								{files.map((file, index) => (
									<li
										key={`${file.name}-${index}`}
										className='bg-muted flex items-center gap-2 rounded px-2 py-1 text-sm'
									>
										<span className='truncate'>{file.name}</span>
										<button
											type='button'
											onClick={() => removeFile(index)}
											className='text-muted-foreground hover:text-foreground ml-auto shrink-0'
										>
											<X className='size-3.5' />
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
						className='bg-primary hover:bg-primary/80 text-black'
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

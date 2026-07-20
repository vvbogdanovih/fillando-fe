'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Textarea } from '@/common/components/ui/textarea'
import { wholesaleApi } from './wholesale.api'
import { wholesaleInquiryFormSchema, type WholesaleInquiryFormValues } from './wholesale.schema'

export function WholesaleInquiryForm({ onSuccess }: { onSuccess?: () => void }) {
	const form = useForm<WholesaleInquiryFormValues>({
		resolver: zodResolver(wholesaleInquiryFormSchema),
		mode: 'onChange',
		defaultValues: { name: '', phone: '', email: '', quantity: '', comment: '' }
	})

	const {
		register,
		handleSubmit,
		formState: { errors, isValid }
	} = form

	const { mutate: submitInquiry, isPending } = useMutation({
		mutationFn: (values: WholesaleInquiryFormValues) => wholesaleApi.create(values),
		onSuccess: () => {
			toast.success("Заявку надіслано! Ми зв'яжемося з вами найближчим часом.")
			form.reset()
			onSuccess?.()
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Не вдалося надіслати заявку. Спробуйте ще раз.')
		}
	})

	return (
		<form onSubmit={handleSubmit(values => submitInquiry(values))} className='space-y-4'>
			<div className='space-y-2'>
				<Label htmlFor='wholesale-name'>Ім&apos;я</Label>
				<Input
					id='wholesale-name'
					placeholder='Іван Петренко'
					{...register('name')}
					aria-invalid={!!errors.name}
				/>
				{errors.name && <p className='text-destructive text-sm'>{errors.name.message}</p>}
			</div>

			<div className='space-y-2'>
				<Label htmlFor='wholesale-phone'>Телефон</Label>
				<Input
					id='wholesale-phone'
					type='tel'
					placeholder='+380XXXXXXXXX'
					{...register('phone')}
					aria-invalid={!!errors.phone}
				/>
				{errors.phone && <p className='text-destructive text-sm'>{errors.phone.message}</p>}
			</div>

			<div className='space-y-2'>
				<Label htmlFor='wholesale-email'>Email</Label>
				<Input
					id='wholesale-email'
					type='email'
					placeholder='email@example.com'
					{...register('email')}
					aria-invalid={!!errors.email}
				/>
				{errors.email && <p className='text-destructive text-sm'>{errors.email.message}</p>}
			</div>

			<div className='space-y-2'>
				<Label htmlFor='wholesale-quantity'>Бажана кількість пластику</Label>
				<Input
					id='wholesale-quantity'
					placeholder='Напр. 20 кг на місяць'
					{...register('quantity')}
					aria-invalid={!!errors.quantity}
				/>
				{errors.quantity && (
					<p className='text-destructive text-sm'>{errors.quantity.message}</p>
				)}
			</div>

			<div className='space-y-2'>
				<Label htmlFor='wholesale-comment'>Коментар (необов&apos;язково)</Label>
				<Textarea
					id='wholesale-comment'
					placeholder='Які матеріали вас цікавлять, умови співпраці тощо'
					{...register('comment')}
				/>
			</div>

			<Button type='submit' className='w-full' disabled={!isValid || isPending}>
				{isPending ? 'Надсилання...' : 'Надіслати заявку'}
			</Button>
		</form>
	)
}

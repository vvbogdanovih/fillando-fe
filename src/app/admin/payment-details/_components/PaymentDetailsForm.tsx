'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { paymentDetailsApi } from '../payment-details.api'
import {
	paymentDetailFormSchema,
	type PaymentDetailFormValues,
	type PaymentDetail
} from '../payment-details.schema'

interface PaymentDetailsFormProps {
	initial: PaymentDetail | null
	onClose: () => void
}

export const PaymentDetailsForm = ({ initial, onClose }: PaymentDetailsFormProps) => {
	const queryClient = useQueryClient()
	const isEditMode = !!initial

	const {
		register,
		handleSubmit,
		formState: { errors }
	} = useForm<PaymentDetailFormValues>({
		resolver: zodResolver(paymentDetailFormSchema),
		defaultValues: {
			last_name: initial?.last_name ?? '',
			first_name: initial?.first_name ?? '',
			middle_name: initial?.middle_name ?? '',
			iban: initial?.iban ?? '',
			edrpou: initial?.edrpou ?? '',
			bank_name: initial?.bank_name ?? ''
		}
	})

	const { mutate: saveRecord, isPending: isSaving } = useMutation({
		mutationFn: async (values: PaymentDetailFormValues) => {
			const payload: PaymentDetailFormValues = {
				...values,
				middle_name: values.middle_name?.trim() ? values.middle_name.trim() : undefined
			}
			return isEditMode
				? paymentDetailsApi.update(initial._id, payload)
				: paymentDetailsApi.create(payload)
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['payment-details'] })
			toast.success(isEditMode ? 'Реквізити збережено' : 'Реквізити створено')
			onClose()
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Помилка збереження')
		}
	})

	const fullName = initial
		? [initial.last_name, initial.first_name, initial.middle_name].filter(Boolean).join(' ')
		: ''

	return (
		<div className='flex h-full flex-col overflow-y-auto bg-white'>
			<div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					{isEditMode ? `Редагування: ${fullName}` : 'Нові реквізити оплати'}
				</h2>
				<Button size='icon-sm' variant='ghost' onClick={onClose}>
					<XIcon className='size-4' />
				</Button>
			</div>

			<div className='p-6'>
				<form
					onSubmit={handleSubmit(vals => saveRecord(vals))}
					className='flex flex-col gap-4'
				>
					<div className='grid gap-4 sm:grid-cols-2'>
						<div className='flex flex-col gap-1.5 sm:col-span-2'>
							<Label htmlFor='pd-last-name'>Прізвище</Label>
							<Input
								id='pd-last-name'
								{...register('last_name')}
								aria-invalid={!!errors.last_name}
							/>
							{errors.last_name && (
								<p className='text-destructive text-xs'>{errors.last_name.message}</p>
							)}
						</div>
						<div className='flex flex-col gap-1.5 sm:col-span-2'>
							<Label htmlFor='pd-first-name'>Ім&apos;я</Label>
							<Input
								id='pd-first-name'
								{...register('first_name')}
								aria-invalid={!!errors.first_name}
							/>
							{errors.first_name && (
								<p className='text-destructive text-xs'>{errors.first_name.message}</p>
							)}
						</div>
						<div className='flex flex-col gap-1.5 sm:col-span-2'>
							<Label htmlFor='pd-middle-name'>По батькові</Label>
							<Input
								id='pd-middle-name'
								placeholder="Необов'язково"
								{...register('middle_name')}
							/>
						</div>
						<div className='flex flex-col gap-1.5 sm:col-span-2'>
							<Label htmlFor='pd-iban'>IBAN</Label>
							<Input id='pd-iban' {...register('iban')} aria-invalid={!!errors.iban} />
							{errors.iban && (
								<p className='text-destructive text-xs'>{errors.iban.message}</p>
							)}
						</div>
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='pd-edrpou'>ЄДРПОУ</Label>
							<Input
								id='pd-edrpou'
								{...register('edrpou')}
								aria-invalid={!!errors.edrpou}
							/>
							{errors.edrpou && (
								<p className='text-destructive text-xs'>{errors.edrpou.message}</p>
							)}
						</div>
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='pd-bank'>Назва банку</Label>
							<Input
								id='pd-bank'
								{...register('bank_name')}
								aria-invalid={!!errors.bank_name}
							/>
							{errors.bank_name && (
								<p className='text-destructive text-xs'>{errors.bank_name.message}</p>
							)}
						</div>
					</div>

					<div className='flex gap-2 pt-2'>
						<Button type='submit' disabled={isSaving}>
							{isSaving ? 'Збереження...' : isEditMode ? 'Зберегти' : 'Створити'}
						</Button>
						<Button type='button' variant='outline' onClick={onClose} disabled={isSaving}>
							Скасувати
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { paymentProvidersApi } from '../payment-providers.api'
import {
	PAYMENT_PROVIDER_LABELS,
	paymentProviderFormSchema,
	type PaymentProvider,
	type PaymentProviderFormValues,
	type PaymentProviderKey
} from '../payment-providers.schema'

interface PaymentProviderFormProps {
	provider: PaymentProviderKey
	initial: PaymentProvider | null
	onClose: () => void
}

export const PaymentProviderForm = ({ provider, initial, onClose }: PaymentProviderFormProps) => {
	const queryClient = useQueryClient()
	const isEditMode = !!initial

	const {
		register,
		handleSubmit,
		setError,
		formState: { errors }
	} = useForm<PaymentProviderFormValues>({
		resolver: zodResolver(paymentProviderFormSchema),
		defaultValues: {
			label: initial?.label ?? '',
			public_key: initial?.public_key ?? '',
			private_key: '',
			sandbox: initial?.sandbox ?? false
		}
	})

	const { mutate: saveRecord, isPending: isSaving } = useMutation({
		mutationFn: async (values: PaymentProviderFormValues) => {
			const privateKey = values.private_key?.trim()
			const payload = {
				label: values.label.trim(),
				public_key: values.public_key.trim(),
				sandbox: values.sandbox ?? false,
				...(privateKey ? { private_key: privateKey } : {})
			}
			return isEditMode
				? paymentProvidersApi.update(initial._id, payload)
				: paymentProvidersApi.create({ ...payload, provider, private_key: privateKey })
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
			toast.success(isEditMode ? 'Ключі збережено' : 'Провайдера створено')
			onClose()
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Помилка збереження')
		}
	})

	const onSubmit = (values: PaymentProviderFormValues) => {
		// private_key is mandatory only when creating a new provider.
		if (!isEditMode && !values.private_key?.trim()) {
			setError('private_key', { type: 'required', message: "Private key є обов'язковим" })
			return
		}
		saveRecord(values)
	}

	return (
		<div className='flex h-full flex-col overflow-y-auto bg-white'>
			<div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					{isEditMode
						? `Редагування: ${initial.label}`
						: `Нові ключі ${PAYMENT_PROVIDER_LABELS[provider]}`}
				</h2>
				<Button size='icon-sm' variant='ghost' onClick={onClose}>
					<XIcon className='size-4' />
				</Button>
			</div>

			<div className='p-6'>
				<form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='pp-label'>Назва</Label>
						<Input
							id='pp-label'
							placeholder='Напр. ФОП Шевченко'
							{...register('label')}
							aria-invalid={!!errors.label}
						/>
						{errors.label && (
							<p className='text-destructive text-xs'>{errors.label.message}</p>
						)}
					</div>

					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='pp-public-key'>Public key</Label>
						<Input
							id='pp-public-key'
							{...register('public_key')}
							aria-invalid={!!errors.public_key}
						/>
						{errors.public_key && (
							<p className='text-destructive text-xs'>{errors.public_key.message}</p>
						)}
					</div>

					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='pp-private-key'>Private key</Label>
						<Input
							id='pp-private-key'
							type='password'
							autoComplete='new-password'
							placeholder={
								isEditMode
									? 'Залиште порожнім, щоб не змінювати'
									: 'Секретний ключ мерчанта'
							}
							{...register('private_key')}
							aria-invalid={!!errors.private_key}
						/>
						{errors.private_key && (
							<p className='text-destructive text-xs'>{errors.private_key.message}</p>
						)}
						<p className='text-xs text-gray-400'>
							Ключ зберігається зашифрованим і ніколи не відображається повністю.
						</p>
					</div>

					<label className='flex cursor-pointer items-center gap-2'>
						<input type='checkbox' className='size-4' {...register('sandbox')} />
						<span className='text-sm text-gray-700'>Тестовий режим (sandbox)</span>
					</label>

					<div className='flex gap-2 pt-2'>
						<Button type='submit' disabled={isSaving}>
							{isSaving ? 'Збереження...' : isEditMode ? 'Зберегти' : 'Створити'}
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={onClose}
							disabled={isSaving}
						>
							Скасувати
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}

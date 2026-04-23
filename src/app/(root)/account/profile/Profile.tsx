'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Badge } from '@/common/components/ui/badge'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { UI_URLS } from '@/common/constants'
import { useAuthStore } from '@/common/store/useAuthStore'
import { profileApi } from './profile.api'
import { profileFormSchema, type ProfileFormValues } from './profile.schema'
import { buildProfileUpdatePayload, mapProfileErrorMessage } from './profile.utils'

type HttpLikeError = Error & {
	status?: number
}

const initialValues: ProfileFormValues = {
	email: '',
	name: '',
	phone: '',
	picture: ''
}

export function Profile() {
	const router = useRouter()
	const setUser = useAuthStore(state => state.setUser)

	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		mode: 'onChange',
		defaultValues: initialValues
	})

	const {
		register,
		handleSubmit,
		reset,
		setError,
		watch,
		formState: { errors, isDirty, dirtyFields }
	} = form

	const { data, error, isLoading, isError, refetch } = useQuery({
		queryKey: ['profile', 'me'],
		queryFn: profileApi.getMe,
		retry: false
	})

	useEffect(() => {
		const typedError = error as HttpLikeError | null
		if (typedError?.status === 401) {
			router.push(UI_URLS.AUTH.LOGIN)
		}
	}, [error, router])

	useEffect(() => {
		if (!data?.user) return

		const nextValues: ProfileFormValues = {
			email: data.user.email,
			name: data.user.name ?? '',
			phone: data.user.phone ?? '',
			picture: data.user.picture ?? ''
		}

		reset(nextValues)
		setUser(data.user)
	}, [data, reset, setUser])

	const { mutate: updateProfile, isPending: isSaving } = useMutation({
		mutationFn: profileApi.updateMe,
		onSuccess: response => {
			reset({
				email: response.user.email,
				name: response.user.name ?? '',
				phone: response.user.phone ?? '',
				picture: response.user.picture ?? ''
			})
			setUser(response.user)
			toast.success('Профіль оновлено')
		},
		onError: error => {
			const typedError = error as HttpLikeError

			if (typedError.status === 401) {
				router.push(UI_URLS.AUTH.LOGIN)
				return
			}

			if (typedError.status === 409) {
				setError('phone', { message: 'Цей номер вже використовується' })
			}

			toast.error(mapProfileErrorMessage(error))
		}
	})

	const onSubmit = (values: ProfileFormValues) => {
		const payload = buildProfileUpdatePayload(values, dirtyFields)

		if (Object.keys(payload).length === 0) {
			return
		}

		updateProfile(payload)
	}

	const watchedPicture = watch('picture')
	const avatarPreview = watchedPicture?.trim() || data?.user.picture || null

	if (isLoading) {
		return (
			<div className='space-y-4'>
				<div className='bg-muted h-8 w-48 animate-pulse rounded-md' />
				<div className='bg-muted h-20 w-full animate-pulse rounded-md' />
				<div className='bg-muted h-20 w-full animate-pulse rounded-md' />
				<div className='bg-muted h-20 w-full animate-pulse rounded-md' />
			</div>
		)
	}

	if (isError || !data?.user) {
		return (
			<div className='space-y-3'>
				<h2 className='text-xl font-semibold'>Профіль</h2>
				<p className='text-destructive text-sm'>Не вдалося завантажити профіль.</p>
				<Button type='button' variant='outline' onClick={() => refetch()}>
					Спробувати ще раз
				</Button>
			</div>
		)
	}

	return (
		<div className='space-y-6'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h2 className='text-xl font-semibold'>Профіль</h2>
					<p className='text-muted-foreground mt-1 text-sm'>
						Оновіть персональні дані вашого акаунта.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<Badge variant='secondary'>{data.user.role}</Badge>
					{data.user.authMethod === 'GOOGLE' && (
						<Badge variant='outline'>Вхід через Google</Badge>
					)}
				</div>
			</div>

			{avatarPreview && (
				<div className='border-border bg-muted/20 w-fit rounded-lg border p-3'>
					<p className='text-muted-foreground mb-2 text-xs'>Превʼю аватара</p>
					<img
						src={avatarPreview}
						alt='Avatar preview'
						className='h-20 w-20 rounded-full border object-cover'
					/>
				</div>
			)}

			<form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
				<div className='grid gap-4 md:grid-cols-2'>
					<div className='space-y-1.5'>
						<Label htmlFor='profile-email'>Email</Label>
						<Input id='profile-email' {...register('email')} disabled readOnly />
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='profile-name'>Імʼя</Label>
						<Input
							id='profile-name'
							placeholder='Введіть імʼя'
							{...register('name')}
							aria-invalid={!!errors.name}
						/>
						{errors.name && <p className='text-destructive text-xs'>{errors.name.message}</p>}
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='profile-phone'>Телефон</Label>
						<Input
							id='profile-phone'
							placeholder='+380XXXXXXXXX'
							{...register('phone')}
							aria-invalid={!!errors.phone}
						/>
						{errors.phone && <p className='text-destructive text-xs'>{errors.phone.message}</p>}
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='profile-picture'>Avatar URL</Label>
						<Input
							id='profile-picture'
							placeholder='https://example.com/avatar.jpg'
							{...register('picture')}
							aria-invalid={!!errors.picture}
						/>
						{errors.picture && (
							<p className='text-destructive text-xs'>{errors.picture.message}</p>
						)}
					</div>
				</div>

				<Button type='submit' disabled={!isDirty || isSaving}>
					{isSaving ? 'Збереження...' : 'Зберегти'}
				</Button>
			</form>
		</div>
	)
}

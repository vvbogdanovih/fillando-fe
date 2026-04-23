'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { authApi } from '../auth.api'
import { registerSchema, type RegisterValues } from '../auth.schema'
import { useAuthStore } from '@/common/store/useAuthStore'
import { UI_URLS } from '@/common/constants'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { PasswordInput } from '@/common/components/ui/password-input'
import { AuthForm } from '../AuthForm'

export const Register = () => {
	const setUser = useAuthStore(state => state.setUser)

	const { mutate: register, isPending } = useMutation({
		mutationFn: (data: RegisterValues) => authApi.register(data),
		onSuccess: data => setUser(data.user)
	})

	const form = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
		mode: 'onChange',
		defaultValues: { name: '', email: '', password: '', confirmPassword: '' }
	})

	const {
		register: registerField,
		formState: { errors }
	} = form

	return (
		<AuthForm
			title='Register'
			form={form}
			onSubmit={register}
			isPending={isPending}
			fields={
				<>
					<div className='flex flex-col gap-2'>
						<Label htmlFor='name'>Name</Label>
						<Input
							id='name'
							type='text'
							placeholder='John Doe'
							autoComplete='name'
							{...registerField('name')}
							aria-invalid={!!errors.name}
						/>
						{errors.name && (
							<p className='text-destructive text-sm'>{errors.name.message}</p>
						)}
					</div>

					<div className='flex flex-col gap-2'>
						<Label htmlFor='email'>Email</Label>
						<Input
							id='email'
							type='email'
							placeholder='email@example.com'
							autoComplete='email'
							{...registerField('email')}
							aria-invalid={!!errors.email}
						/>
						{errors.email && (
							<p className='text-destructive text-sm'>{errors.email.message}</p>
						)}
					</div>

					<div className='flex flex-col gap-2'>
						<Label htmlFor='password'>Password</Label>
						<PasswordInput
							id='password'
							placeholder='••••••••'
							autoComplete='new-password'
							{...registerField('password')}
							error={!!errors.password}
						/>
						{errors.password && (
							<p className='text-destructive text-sm'>{errors.password.message}</p>
						)}
					</div>

					<div className='flex flex-col gap-2'>
						<Label htmlFor='confirmPassword'>Confirm Password</Label>
						<PasswordInput
							id='confirmPassword'
							placeholder='••••••••'
							autoComplete='new-password'
							{...registerField('confirmPassword')}
							error={!!errors.confirmPassword}
						/>
						{errors.confirmPassword && (
							<p className='text-destructive text-sm'>
								{errors.confirmPassword.message}
							</p>
						)}
					</div>
				</>
			}
			footer={
				<p className='text-muted-foreground text-center text-sm'>
					Вже маєте аккаунт?{' '}
					<Link
						href={UI_URLS.AUTH.LOGIN}
						className='text-primary font-medium hover:underline'
					>
						Увійти
					</Link>
				</p>
			}
		/>
	)
}

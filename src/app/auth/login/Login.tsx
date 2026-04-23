'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { authApi } from '../auth.api'
import { loginSchema, type LoginValues } from '../auth.schema'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { UI_URLS } from '@/common/constants'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { PasswordInput } from '@/common/components/ui/password-input'
import { AuthForm } from '../AuthForm'

export const Login = () => {
	const setUser = useAuthStore(state => state.setUser)
	const mergeAndSync = useCartStore(state => state.mergeAndSync)

	const { mutate: login, isPending } = useMutation({
		mutationFn: (data: LoginValues) => authApi.login(data),
		onSuccess: async data => {
			setUser(data.user)
			await mergeAndSync()
		}
	})

	const form = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		mode: 'onChange',
		defaultValues: { email: '', password: '' }
	})

	const {
		register,
		formState: { errors }
	} = form

	return (
		<AuthForm
			title='Login'
			form={form}
			onSubmit={login}
			isPending={isPending}
			fields={
				<>
					<div className='flex flex-col gap-2'>
						<Label htmlFor='email'>Email</Label>
						<Input
							id='email'
							type='email'
							placeholder='email@example.com'
							autoComplete='email'
							{...register('email')}
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
							autoComplete='current-password'
							{...register('password')}
							error={!!errors.password}
						/>
						{errors.password && (
							<p className='text-destructive text-sm'>{errors.password.message}</p>
						)}
					</div>
				</>
			}
			footer={
				<p className='text-muted-foreground text-center text-sm'>
					Немає аккаунта?{' '}
					<Link
						href={UI_URLS.AUTH.REGISTER}
						className='text-primary font-medium hover:underline'
					>
						Зареєструватися
					</Link>
				</p>
			}
		/>
	)
}

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthForm } from './AuthForm'
import { loginSchema, type LoginValues } from './auth.schema'
afterEach(cleanup)
function Harness({ submit }: { submit: (values: LoginValues) => void }) {
	const form = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		mode: 'onChange',
		defaultValues: { email: '', password: '' }
	})
	return (
		<AuthForm
			title='Login'
			form={form}
			onSubmit={submit}
			isPending={false}
			footer={null}
			fields={
				<>
					<input aria-label='Email' {...form.register('email')} />
					<input aria-label='Password' {...form.register('password')} />
				</>
			}
		/>
	)
}
it('validates on submit without permanently disabling login; invalid credentials never reach the handler', async () => {
	const submit = vi.fn()
	render(<Harness submit={submit} />)
	const button = screen.getByRole('button', { name: 'Login' })
	fireEvent.click(button)
	await waitFor(() => expect(button).not.toBeDisabled())
	expect(submit).not.toHaveBeenCalled()
	fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
	fireEvent.change(screen.getByLabelText('Password'), {
		target: { value: 'valid-test-password' }
	})
	fireEvent.click(button)
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
})

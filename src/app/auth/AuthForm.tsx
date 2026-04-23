'use client'

import { type ReactNode } from 'react'
import { type FieldValues, type UseFormReturn } from 'react-hook-form'
import { FcGoogle } from 'react-icons/fc'
import { Button } from '@/common/components/ui/button'
import { API_BASE_URL, API_URLS } from '@/common/constants'

/**
 * Shared shell for authentication forms (login, register).
 *
 * Owns: outer layout, form element, title heading, submit button, Google OAuth button.
 * Callers own: field inputs (`fields` slot) and the footer link (`footer` slot).
 *
 * The submit button label is derived from `title` (same string used as the heading).
 * The Google OAuth button always redirects to `API_BASE_URL + /auth/google`.
 *
 * @example
 * <AuthForm
 *   title='Login'
 *   form={form}
 *   onSubmit={handleLogin}
 *   isPending={isPending}
 *   fields={<>email + password inputs</>}
 *   footer={<Link href='/auth/register'>Register</Link>}
 * />
 */
interface AuthFormProps<T extends FieldValues> {
	/** Displayed as the form heading and submit button label. */
	title: string
	/** UseFormReturn instance from React Hook Form. */
	form: UseFormReturn<T>
	/** Called with validated form data on submit. */
	onSubmit: (data: T) => void
	/** True while the mutation is in-flight (disables the submit button). */
	isPending: boolean
	/** Form field inputs rendered inside the <form> element. */
	fields: ReactNode
	/** Content rendered below the submit button (e.g. "Already have an account?" link). */
	footer: ReactNode
}

export function AuthForm<T extends FieldValues>({
	title,
	form,
	onSubmit,
	isPending,
	fields,
	footer
}: AuthFormProps<T>) {
	const {
		handleSubmit,
		formState: { isSubmitting, isValid }
	} = form

	return (
		<div className='flex h-screen w-full flex-col items-center justify-center'>
			<form
				onSubmit={handleSubmit(onSubmit)}
				className='bg-card flex w-full max-w-sm flex-col gap-4 rounded-xl border p-10 shadow-(--shadow-glow)'
			>
				<div className='text-2xl font-bold'>{title}</div>

				{fields}

				<Button type='submit' disabled={!isValid || isSubmitting || isPending}>
					{isSubmitting || isPending ? 'Loading...' : title}
				</Button>

				{footer}

				<div className='border-border border-t pt-8'>
					<Button
						type='button'
						variant='outline'
						className='w-full'
						onClick={() => {
							window.location.href = API_BASE_URL + API_URLS.AUTH.GOOGLE
						}}
					>
						<FcGoogle className='size-5' />
						Увійти через Google
					</Button>
				</div>
			</form>
		</div>
	)
}

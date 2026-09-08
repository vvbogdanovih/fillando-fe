'use client'

import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { startLiqpayCheckout } from '@/app/(root)/checkout/liqpay.utils'
import { describePaymentError, minutesLeft } from './order-payment.api'

interface PayNowButtonProps {
	orderNumber: string
	/**
	 * The lookup's cooldown clock: `null`/`0` — a session may be opened now; `n` — the previous
	 * one may still be live, so the button waits instead of failing; `undefined` — unknown
	 * (older backend), let the server decide.
	 */
	retryAfterSeconds: number | null | undefined
	/** Called after a failed init so the caller can refresh the order (it may be PAID by now). */
	onError?: () => void
	/** The wording of the action; a payment the bank already refused is a retry, not a first try. */
	label?: string
	className?: string
}

/**
 * «Оплатити карткою» for a LiqPay order whose payment is still awaited (TD-0009 §5.4.3). Same
 * two steps as the checkout's retry: init the payload, form-POST to LiqPay. The backend keeps
 * one live session per order; this button shows the remaining wait instead of a click that is
 * bound to answer 409.
 */
export function PayNowButton({
	orderNumber,
	retryAfterSeconds,
	onError,
	label = 'Оплатити карткою',
	className
}: PayNowButtonProps) {
	const mutation = useMutation({
		mutationFn: () => startLiqpayCheckout(orderNumber),
		onError: (err: unknown) => {
			toast.error(describePaymentError(err))
			onError?.()
		}
	})

	const waiting = typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
	const text = waiting ? `${label} можна через ${minutesLeft(retryAfterSeconds)} хв` : label

	return (
		<Button
			type='button'
			className={className}
			disabled={waiting || mutation.isPending}
			title={
				waiting
					? 'Попередню сторінку оплати ще може бути завершено. Зачекайте або оберіть інший спосіб оплати.'
					: undefined
			}
			onClick={() => mutation.mutate()}
		>
			{mutation.isPending ? (
				<Loader2 className='h-4 w-4 animate-spin' aria-hidden />
			) : (
				<CreditCard className='h-4 w-4' aria-hidden />
			)}
			{text}
		</Button>
	)
}

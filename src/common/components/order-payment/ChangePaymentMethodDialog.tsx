'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/common/components/ui/dialog'
import { useLenisModalLock } from '@/common/hooks/useLenisModalLock'
import type { CustomerSelectablePaymentMethod } from '@/common/constants/payment.constants'
import type { DeliveryMethod, PaymentMethod } from '@/app/(root)/profile/orders/orders.schema'
import { PaymentMethodOptions } from './PaymentMethodOptions'
import { describePaymentError } from './order-payment.api'

interface ChangePaymentMethodDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	orderNumber: string
	currentMethod: PaymentMethod
	deliveryMethod: DeliveryMethod
	/** Performs the change — the token-gated call on the success page, the signed-in one in the account. */
	onSubmit: (method: CustomerSelectablePaymentMethod) => Promise<unknown>
	/** Called after a successful change, so the caller refreshes what it shows. */
	onChanged?: () => void
}

/**
 * «Обрати інший спосіб оплати» for an unpaid order (TD-0009 §5.4.4). The dialog only picks a
 * method and reports the outcome; which endpoint applies it is the caller's business, so the
 * same dialog serves a guest with a token and a signed-in buyer without one.
 */
export function ChangePaymentMethodDialog({
	open,
	onOpenChange,
	orderNumber,
	currentMethod,
	deliveryMethod,
	onSubmit,
	onChanged
}: ChangePaymentMethodDialogProps) {
	const [selected, setSelected] = useState<CustomerSelectablePaymentMethod | null>(null)
	useLenisModalLock(open)

	const mutation = useMutation({
		mutationFn: (method: CustomerSelectablePaymentMethod) => onSubmit(method),
		onSuccess: () => {
			toast.success('Спосіб оплати змінено')
			onOpenChange(false)
			setSelected(null)
			onChanged?.()
		},
		onError: (err: unknown) => {
			toast.error(describePaymentError(err))
		}
	})

	return (
		<Dialog open={open} onOpenChange={next => !mutation.isPending && onOpenChange(next)}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle>Інший спосіб оплати</DialogTitle>
					<DialogDescription>
						Замовлення №{orderNumber} збережено. Оберіть, як зручніше оплатити — ми
						надішлемо лист із подальшими кроками.
					</DialogDescription>
				</DialogHeader>
				<PaymentMethodOptions
					value={selected}
					onChange={setSelected}
					deliveryMethod={deliveryMethod}
					currentMethod={currentMethod}
				/>
				<DialogFooter>
					<Button
						type='button'
						variant='outline'
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						Скасувати
					</Button>
					<Button
						type='button'
						disabled={!selected || mutation.isPending}
						onClick={() => selected && mutation.mutate(selected)}
					>
						{mutation.isPending && (
							<Loader2 className='h-4 w-4 animate-spin' aria-hidden />
						)}
						Змінити спосіб оплати
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

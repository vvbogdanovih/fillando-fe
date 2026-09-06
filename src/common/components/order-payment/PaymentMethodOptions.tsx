'use client'

import {
	CUSTOMER_SELECTABLE_PAYMENT_METHODS,
	isPaymentMethodAllowed,
	paymentMethodRestriction,
	type CustomerSelectablePaymentMethod
} from '@/common/constants/payment.constants'
import { PAYMENT_METHOD_LABELS } from '@/app/(root)/profile/orders/orders.constants'
import type { DeliveryMethod, PaymentMethod } from '@/app/(root)/profile/orders/orders.schema'
import { COD_MIN_PREPAYMENT_UAH } from '@/app/(root)/checkout/checkout.constants'
import { cn } from '@/common/utils/shad-cn.utils'

const DESCRIPTIONS: Record<CustomerSelectablePaymentMethod, string> = {
	COD: `Оплата при отриманні у відділенні. Потрібна часткова передоплата від ${COD_MIN_PREPAYMENT_UAH} ₴ — менеджер уточнить суму.`,
	IBAN: 'Реквізити для переказу надійдуть на пошту після підтвердження замовлення.',
	CASH: 'Оплата готівкою при самовивозі.'
}

interface PaymentMethodOptionsProps {
	value: CustomerSelectablePaymentMethod | null
	onChange: (method: CustomerSelectablePaymentMethod) => void
	/** Decides which methods fit: COD needs a carrier, CASH needs pickup. */
	deliveryMethod: DeliveryMethod
	/** The method the order has now; offered as "поточний", not selectable. */
	currentMethod: PaymentMethod
	idPrefix?: string
}

/**
 * The three offline methods a buyer may switch an unpaid order to (TD-0009 §5.4.4). Purposely
 * not the checkout's radios: those are bound to the form and its COD confirmation dialog; this
 * is a plain list with the same compatibility rule and the same hints.
 */
export function PaymentMethodOptions({
	value,
	onChange,
	deliveryMethod,
	currentMethod,
	idPrefix = 'pm-'
}: PaymentMethodOptionsProps) {
	return (
		<div role='radiogroup' aria-label='Спосіб оплати' className='space-y-2'>
			{CUSTOMER_SELECTABLE_PAYMENT_METHODS.map(method => {
				const isCurrent = method === currentMethod
				const allowed = isPaymentMethodAllowed(method, deliveryMethod)
				const disabled = isCurrent || !allowed
				const id = `${idPrefix}${method}`
				const hint = isCurrent
					? 'Поточний спосіб оплати'
					: !allowed
						? paymentMethodRestriction(method)
						: null
				return (
					<label
						key={method}
						htmlFor={id}
						className={cn(
							'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
							disabled
								? 'border-border/50 text-muted-foreground cursor-not-allowed opacity-70'
								: 'hover:border-primary/60 cursor-pointer',
							value === method && !disabled && 'border-primary bg-primary/5'
						)}
					>
						<input
							id={id}
							type='radio'
							name={`${idPrefix}payment-method`}
							value={method}
							checked={value === method}
							disabled={disabled}
							onChange={() => onChange(method)}
							className='mt-1 accent-current'
						/>
						<span className='min-w-0 flex-1'>
							<span className='block text-sm font-medium'>
								{PAYMENT_METHOD_LABELS[method]}
							</span>
							<span className='text-muted-foreground block text-xs leading-relaxed'>
								{hint ?? DESCRIPTIONS[method]}
							</span>
						</span>
					</label>
				)
			})}
		</div>
	)
}

import { COD_MIN_PREPAYMENT_UAH } from '@/app/(root)/checkout/checkout.constants'
import type { PaymentMethod, PaymentStatus } from '@/app/(root)/profile/orders/orders.schema'

/**
 * One wording for the state of an unpaid order, shared by `/checkout/success` and the buyer's
 * cabinet. Both screens offer the same two actions, so they must also explain the same state
 * the same way — the cabinet used to show «Статус: Помилка оплати» and nothing else, leaving
 * the buyer to guess whether the money had left the account (TD-0009 §5.4).
 */
export const PAYMENT_FAILED_DESCRIPTION =
	'Банк відхилив платіж — кошти не списано. Замовлення збережено: можна оплатити карткою ще раз або обрати інший спосіб оплати.'

export const PAYMENT_NOT_CONFIRMED_DESCRIPTION =
	'Статус оплати ще не підтверджено. Щойно банк підтвердить платіж, ми надішлемо лист.'

/**
 * PENDING with no card session ever opened — the checkout could not reach LiqPay. Nothing is
 * coming from the bank, so there is nothing to wait for: offer the payment right away.
 */
export const PAYMENT_NOT_STARTED_DESCRIPTION =
	'Оплату карткою не розпочато. Ви можете оплатити зараз або обрати інший спосіб оплати.'

export function describeOfflinePayment(paymentMethod: string | null): string {
	switch (paymentMethod) {
		case 'CASH':
			return 'Оплата готівкою при отриманні. Деталі замовлення надіслані на вашу електронну пошту.'
		case 'COD':
			return `Відправка накладним платежем — з частковою передоплатою від ${COD_MIN_PREPAYMENT_UAH} ₴. Наш менеджер зв'яжеться з вами й уточнить суму. Деталі замовлення надіслані на вашу електронну пошту.`
		default:
			return 'Реквізити для оплати будуть надіслані на вашу електронну пошту.'
	}
}

/**
 * The explanation an order gets while its payment is still open. `null` for a payment that is
 * settled one way or another (PAID / REFUNDED / VOIDED) — those states are not the buyer's to
 * act on and each screen words them itself.
 */
export function describeUnpaidPayment(args: {
	paymentMethod: PaymentMethod
	paymentStatus: PaymentStatus
	/** TD-0009's cooldown clock: `null` — no card session was ever opened; `undefined` — unknown. */
	retryAfterSeconds: number | null | undefined
}): string | null {
	const { paymentMethod, paymentStatus, retryAfterSeconds } = args
	if (paymentStatus === 'FAILED') return PAYMENT_FAILED_DESCRIPTION
	if (paymentStatus !== 'PENDING') return null
	if (paymentMethod !== 'LIQPAY' && paymentMethod !== 'CARD' && paymentMethod !== 'MONOPAY') {
		return describeOfflinePayment(paymentMethod)
	}
	return retryAfterSeconds === null
		? PAYMENT_NOT_STARTED_DESCRIPTION
		: PAYMENT_NOT_CONFIRMED_DESCRIPTION
}

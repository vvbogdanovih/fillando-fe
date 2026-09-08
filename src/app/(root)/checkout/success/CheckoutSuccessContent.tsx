'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { ChangePaymentMethodDialog } from '@/common/components/order-payment/ChangePaymentMethodDialog'
import { PayNowButton } from '@/common/components/order-payment/PayNowButton'
import {
	changePaymentMethodPublic,
	describePaymentError
} from '@/common/components/order-payment/order-payment.api'
import {
	describeOfflinePayment,
	PAYMENT_FAILED_DESCRIPTION,
	PAYMENT_NOT_CONFIRMED_DESCRIPTION,
	PAYMENT_NOT_STARTED_DESCRIPTION
} from '@/common/components/order-payment/payment-state.copy'
import { UI_URLS } from '@/common/constants'
import { SITE_NAME } from '@/common/constants/seo.constants'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { cn } from '@/common/utils/shad-cn.utils'
import { gtag } from '@/common/lib/gtag'
import { trackPurchase } from '@/common/lib/ga4-events'
import { GOOGLE_ADS_PURCHASE_CONVERSION } from '@/common/constants/analytics.constants'
import { formatOrderNumber } from '../checkout.schema'
import { fetchOrderPaymentStatus } from '../checkout.api'
import type { OrderPaymentStatus } from '../checkout.api.schemas'
import { startLiqpayCheckout } from '../liqpay.utils'

// LiqPay sends the browser back to result_url before (or at the same time as) its
// server callback flips the order to PAID, so a PENDING lookup is re-polled for a
// bounded window instead of being trusted on the first read.
const LIQPAY_POLL_INTERVAL_MS = 3_000
const LIQPAY_POLL_WINDOW_MS = 60_000

type Tone = 'success' | 'pending' | 'failed' | 'neutral'

type View = {
	tone: Tone
	title: string
	description: string
}

const TONE_STYLES: Record<Tone, { card: string; badge: string; icon: string }> = {
	success: { card: 'border-primary/20', badge: 'bg-primary/10', icon: 'text-primary' },
	pending: { card: 'border-primary/20', badge: 'bg-muted', icon: 'text-muted-foreground' },
	failed: {
		card: 'border-destructive/20',
		badge: 'bg-destructive/10',
		icon: 'text-destructive'
	},
	neutral: { card: 'border-primary/20', badge: 'bg-muted', icon: 'text-muted-foreground' }
}

const ORDER_ACCEPTED: View = {
	tone: 'neutral',
	title: 'Замовлення прийнято',
	description: 'Статус оплати ми перевіряємо. Лист із підтвердженням надійде на вашу пошту.'
}

const PAYMENT_NOT_CONFIRMED: View = {
	tone: 'neutral',
	title: 'Замовлення прийнято',
	description: PAYMENT_NOT_CONFIRMED_DESCRIPTION
}

const PAYMENT_NOT_STARTED: View = {
	tone: 'neutral',
	title: 'Замовлення прийнято',
	description: PAYMENT_NOT_STARTED_DESCRIPTION
}

function resolveLiqpayView(args: {
	canLookup: boolean
	lookup: OrderPaymentStatus | undefined
	isError: boolean
	pollingExpired: boolean
}): View {
	const { canLookup, lookup, isError, pollingExpired } = args
	if (!canLookup) return ORDER_ACCEPTED
	if (lookup) {
		// Keyed on the lookup, not the URL: after «Обрати інший спосіб оплати» the address still
		// says LIQPAY, while the order is now COD/IBAN/CASH and awaits that payment instead.
		if (lookup.payment_method !== 'LIQPAY') {
			return {
				tone: 'success',
				title: 'Спосіб оплати змінено',
				description: describeOfflinePayment(lookup.payment_method)
			}
		}
		switch (lookup.payment_status) {
			case 'PAID':
				return {
					tone: 'success',
					title: 'Дякуємо за замовлення!',
					description:
						'Оплату через LiqPay отримано. Підтвердження надіслано на вашу електронну пошту.'
				}
			case 'FAILED':
				return {
					tone: 'failed',
					title: 'Оплата не пройшла',
					description: PAYMENT_FAILED_DESCRIPTION
				}
			// VOIDED is not a bank refusal: the order was cancelled while unpaid and the payment
			// closed with it (state-machines.md). The gateway refuses a cancelled order with 400, so
			// offering «Повторити оплату» here would only produce an error — neutral tone, no actions.
			case 'VOIDED':
				return {
					tone: 'neutral',
					title: 'Замовлення скасовано',
					description:
						'Замовлення скасовано, кошти не списувалися. Якщо це сталося помилково — зв’яжіться з нами, і ми його відновимо.'
				}
			case 'REFUNDED':
				return {
					tone: 'neutral',
					title: 'Замовлення прийнято',
					description:
						'Кошти за цим замовленням повернено. Деталі надіслані на вашу електронну пошту.'
				}
			case 'PENDING':
				if (lookup.liqpay_retry_after_seconds === null) return PAYMENT_NOT_STARTED
				return pollingExpired
					? PAYMENT_NOT_CONFIRMED
					: {
							tone: 'pending',
							title: 'Очікуємо підтвердження оплати…',
							description:
								'Банк підтверджує платіж — зазвичай це займає кілька секунд.'
						}
		}
	}
	if (isError) return PAYMENT_NOT_CONFIRMED
	return {
		tone: 'pending',
		title: 'Перевіряємо статус оплати…',
		description: 'Це займе лише кілька секунд.'
	}
}

function ToneIcon({ tone, className }: { tone: Tone; className: string }) {
	switch (tone) {
		case 'success':
			return <CheckCircle2 className={className} />
		case 'pending':
			return <Loader2 className={cn(className, 'animate-spin')} aria-hidden />
		case 'failed':
			return <XCircle className={className} />
		case 'neutral':
			return <Clock className={className} />
	}
}

export function CheckoutSuccessContent() {
	const searchParams = useSearchParams()
	const parseNumber = (value: string | null) => (value === null ? Number.NaN : Number(value))
	const raw = searchParams.get('order')
	const formatted = raw ? formatOrderNumber(raw) : null
	const subtotal = parseNumber(searchParams.get('subtotal'))
	const total = parseNumber(searchParams.get('total'))
	const discountCode = searchParams.get('discountCode')
	const discountPercent = parseNumber(searchParams.get('discountPercent'))
	const discountAmount = parseNumber(searchParams.get('discountAmount'))
	const hasSubtotal = Number.isFinite(subtotal)
	const hasTotal = Number.isFinite(total)
	const hasDiscount = Number.isFinite(discountAmount) && discountAmount > 0
	const paymentMethod = searchParams.get('payment')
	const token = searchParams.get('token')

	const isLiqpay = paymentMethod === 'LIQPAY'
	const canLookup = isLiqpay && Boolean(raw) && Boolean(token)
	const queryClient = useQueryClient()
	const [isChangeOpen, setIsChangeOpen] = useState(false)

	// State (not a bare timestamp) so that closing the window re-renders the card and,
	// through the re-evaluated `refetchInterval` below, stops the poller in one step.
	const [pollingExpired, setPollingExpired] = useState(false)
	useEffect(() => {
		if (!canLookup) return
		const timer = window.setTimeout(() => setPollingExpired(true), LIQPAY_POLL_WINDOW_MS)
		return () => window.clearTimeout(timer)
	}, [canLookup])

	const lookupQuery = useQuery({
		queryKey: ['order-payment-status', raw, token],
		queryFn: () => fetchOrderPaymentStatus(raw ?? '', token ?? ''),
		enabled: canLookup,
		// 404/400 are definitive (wrong token / bad order number) — only retry transient failures.
		retry: (count, err) => {
			const status = (err as { status?: number }).status
			return status !== 404 && status !== 400 && count < 2
		},
		// Only a LiqPay order awaiting the bank is worth re-asking; an order moved to COD/IBAN/
		// CASH stays PENDING until the money arrives offline, and no callback will change that.
		// A PENDING order that never reached LiqPay has nothing to wait for either.
		refetchInterval: query => {
			const data = query.state.data
			return data?.payment_status === 'PENDING' &&
				data.payment_method === 'LIQPAY' &&
				data.liqpay_retry_after_seconds !== null &&
				!pollingExpired
				? LIQPAY_POLL_INTERVAL_MS
				: false
		}
	})
	const lookup = lookupQuery.data

	// The lookup's cooldown is a snapshot taken when the answer was written. Polling stops after
	// LIQPAY_POLL_WINDOW_MS, so without a clock of its own the page kept the card button disabled
	// with «можна через N хв» long after those minutes had passed — until a manual reload.
	const [cooldownLeft, setCooldownLeft] = useState<number | null | undefined>(undefined)
	useEffect(() => {
		setCooldownLeft(lookup?.liqpay_retry_after_seconds)
	}, [lookup])

	const cooldownRunning = typeof cooldownLeft === 'number' && cooldownLeft > 0
	useEffect(() => {
		if (!cooldownRunning) return
		const timer = window.setInterval(() => {
			setCooldownLeft(prev => (typeof prev === 'number' && prev > 0 ? prev - 1 : prev))
		}, 1_000)
		return () => window.clearInterval(timer)
	}, [cooldownRunning])

	// Once the polling window is over the query is idle, so a late PAID or FAILED would never
	// reach this page. Re-read it when the buyer comes back to the tab — an event, so there is
	// no interval to run away with. A settled payment (PAID / VOIDED / REFUNDED) is terminal
	// and is not asked about again.
	const paymentStillOpen =
		lookup === undefined ||
		lookup.payment_status === 'PENDING' ||
		lookup.payment_status === 'FAILED'
	useEffect(() => {
		if (!canLookup || !pollingExpired || !paymentStillOpen) return
		const refresh = () => {
			if (document.visibilityState !== 'hidden') {
				void queryClient.refetchQueries({ queryKey: ['order-payment-status', raw, token] })
			}
		}
		document.addEventListener('visibilitychange', refresh)
		window.addEventListener('focus', refresh)
		return () => {
			document.removeEventListener('visibilitychange', refresh)
			window.removeEventListener('focus', refresh)
		}
	}, [canLookup, pollingExpired, paymentStillOpen, queryClient, raw, token])

	const retryMutation = useMutation({
		mutationFn: () => startLiqpayCheckout(raw ?? ''),
		onError: (err: unknown) => {
			toast.error(describePaymentError(err))
			// A 400 here usually means the order got PAID meanwhile (another tab, late
			// callback) — refresh the status so the card catches up.
			void lookupQuery.refetch()
		}
	})

	// Google Ads: offline methods convert on arrival, LiqPay only once the bank confirmed —
	// or once the buyer moved the order to an offline method, which is the same commitment
	// a COD/IBAN checkout makes on its own success page.
	const shouldConvert = isLiqpay
		? lookup?.payment_status === 'PAID' ||
			(lookup !== undefined && lookup.payment_method !== 'LIQPAY')
		: true
	const conversionValue = isLiqpay ? lookup?.total_price : hasTotal ? total : undefined

	const conversionSent = useRef(false)
	useEffect(() => {
		if (!shouldConvert || conversionSent.current) return
		conversionSent.current = true
		// Queued onto window.dataLayer rather than called through window.gtag: the tag
		// is consent-gated and may not have loaded (or may load minutes later, when the
		// visitor accepts). gtag.js drains the queue on startup, so the conversion
		// survives. The previous `typeof window.gtag !== 'function'` guard returned
		// without setting the ref, and with stable deps the effect never re-ran —
		// silently dropping the conversion whenever the tag was slow.
		gtag('event', 'conversion', {
			send_to: GOOGLE_ADS_PURCHASE_CONVERSION,
			transaction_id: raw ?? '',
			...(conversionValue !== undefined ? { value: conversionValue, currency: 'UAH' } : {})
		})
		// GA4 purchase rides on the same guard, so it fires exactly when the Ads conversion does.
		// Aggregated on purpose: the cart is already cleared and the line items are not here.
		trackPurchase({ transaction_id: raw ?? '', value: conversionValue })
	}, [shouldConvert, conversionValue, raw])

	const view: View = isLiqpay
		? resolveLiqpayView({
				canLookup,
				lookup,
				isError: lookupQuery.isError,
				pollingExpired
			})
		: {
				tone: 'success',
				title: 'Дякуємо за замовлення!',
				description: describeOfflinePayment(paymentMethod)
			}
	const styles = TONE_STYLES[view.tone]

	// The route's metadata has to be neutral («Статус оплати» covers a refusal as well as a
	// thank-you), so the tab name is sharpened here, where the state is known. The page is
	// noindex, so this is a browser-tab concern only.
	useEffect(() => {
		document.title = `${view.title} | ${SITE_NAME}`
	}, [view.title])

	// Offline methods carry totals in the URL; the LiqPay return does not, so fall back
	// to the amount the lookup reports.
	const displayTotal = hasTotal ? total : lookup?.total_price
	const hasDisplayTotal = displayTotal !== undefined && Number.isFinite(displayTotal)

	// The server decides whether the method may still change; an older backend that does not
	// say so has no endpoint to change it either, so "unknown" reads as "no".
	const canChangeMethod =
		lookup?.can_change_payment_method === true &&
		lookup.payment_method === 'LIQPAY' &&
		lookup.delivery_method !== undefined
	// «Оплатити» for a still-awaited card payment: once the bank said no (the failed view has
	// its own retry), once nothing is coming (no session was ever opened), or once the polling
	// window is over and the card is not going to flip on its own.
	const showPayNow =
		lookup?.payment_status === 'PENDING' &&
		lookup.payment_method === 'LIQPAY' &&
		(lookup.liqpay_retry_after_seconds === null || pollingExpired)
	const showChangeMethod = canChangeMethod && (view.tone === 'failed' || showPayNow)
	const hasActions = Boolean(raw) && (view.tone === 'failed' || showPayNow)

	return (
		<div className='mx-auto max-w-lg px-4 py-12 md:py-20'>
			<Card className={styles.card}>
				<CardHeader className='text-center'>
					<div
						className={cn(
							'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full',
							styles.badge
						)}
					>
						<ToneIcon tone={view.tone} className={cn('h-9 w-9', styles.icon)} />
					</div>
					<CardTitle className='text-2xl'>{view.title}</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4 text-center'>
					{formatted ? (
						<p className='text-lg'>
							Номер замовлення:{' '}
							<span className='text-primary font-bold tabular-nums'>
								#{formatted}
							</span>
						</p>
					) : (
						<p className='text-muted-foreground text-sm'>
							Замовлення успішно прийнято.
						</p>
					)}
					<p className='text-muted-foreground text-sm leading-relaxed'>
						{view.description}
					</p>
					{hasDisplayTotal && (
						<div className='rounded-lg border p-3 text-left'>
							{hasDiscount && hasSubtotal && (
								<div className='mb-2 flex items-center justify-between text-sm'>
									<span className='text-muted-foreground'>
										Підсумок до знижки
									</span>
									<span>{subtotal.toLocaleString('uk-UA')} ₴</span>
								</div>
							)}
							{hasDiscount && (
								<div className='mb-2 flex items-center justify-between text-sm'>
									<span className='text-muted-foreground'>
										Знижка {discountCode ? `(${discountCode})` : ''}
										{Number.isFinite(discountPercent)
											? ` ${discountPercent}%`
											: ''}
									</span>
									<span>-{discountAmount.toLocaleString('uk-UA')} ₴</span>
								</div>
							)}
							<div className='flex items-center justify-between text-base font-semibold'>
								<span>Разом</span>
								<span className='text-primary'>
									{displayTotal.toLocaleString('uk-UA')} ₴
								</span>
							</div>
						</div>
					)}
					{hasActions && raw ? (
						<>
							{view.tone === 'failed' ? (
								<Button
									type='button'
									className='mt-2 w-full'
									disabled={retryMutation.isPending}
									onClick={() => retryMutation.mutate()}
								>
									{retryMutation.isPending ? (
										<Loader2 className='h-4 w-4 animate-spin' aria-hidden />
									) : (
										<RefreshCw className='h-4 w-4' aria-hidden />
									)}
									Повторити оплату карткою
								</Button>
							) : (
								<PayNowButton
									orderNumber={raw}
									retryAfterSeconds={cooldownLeft}
									onError={() => void lookupQuery.refetch()}
									className='mt-2 w-full'
								/>
							)}
							{showChangeMethod && lookup?.delivery_method && (
								<>
									<Button
										type='button'
										variant='outline'
										className='w-full'
										onClick={() => setIsChangeOpen(true)}
									>
										Обрати інший спосіб оплати
									</Button>
									<ChangePaymentMethodDialog
										open={isChangeOpen}
										onOpenChange={setIsChangeOpen}
										orderNumber={raw}
										currentMethod={lookup.payment_method}
										deliveryMethod={lookup.delivery_method}
										onSubmit={async method => {
											const next = await changePaymentMethodPublic(
												raw,
												token ?? '',
												method
											)
											// The response is the fresh lookup: no second round trip.
											queryClient.setQueryData(
												['order-payment-status', raw, token],
												next
											)
											return next
										}}
									/>
								</>
							)}
						</>
					) : (
						<Button asChild className='mt-2 w-full'>
							<Link href={UI_URLS.CATALOG.FILAMENT}>Продовжити покупки</Link>
						</Button>
					)}
					<Link
						href={UI_URLS.HOME}
						className='text-muted-foreground hover:text-foreground inline-block text-sm underline-offset-4 hover:underline'
					>
						На головну
					</Link>
				</CardContent>
			</Card>
		</div>
	)
}

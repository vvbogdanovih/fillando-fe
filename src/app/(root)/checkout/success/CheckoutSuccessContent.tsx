'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { UI_URLS } from '@/common/constants'
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
import { COD_MIN_PREPAYMENT_UAH } from '../checkout.constants'

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
	description:
		'Статус оплати ще не підтверджено. Щойно банк підтвердить платіж, ми надішлемо лист.'
}

function describeOfflinePayment(paymentMethod: string | null): string {
	switch (paymentMethod) {
		case 'CASH':
			return 'Оплата готівкою при отриманні. Деталі замовлення надіслані на вашу електронну пошту.'
		case 'COD':
			return `Відправка накладним платежем — з частковою передоплатою від ${COD_MIN_PREPAYMENT_UAH} ₴. Наш менеджер зв'яжеться з вами й уточнить суму. Деталі замовлення надіслані на вашу електронну пошту.`
		default:
			return 'Реквізити для оплати будуть надіслані на вашу електронну пошту.'
	}
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
		switch (lookup.payment_status) {
			case 'PAID':
				return {
					tone: 'success',
					title: 'Дякуємо за замовлення!',
					description:
						'Оплату через LiqPay отримано. Підтвердження надіслано на вашу електронну пошту.'
				}
			case 'FAILED':
			case 'VOIDED':
				return {
					tone: 'failed',
					title: 'Оплата не пройшла',
					description:
						'Банк відхилив платіж — кошти не списано. Замовлення збережено, товари зарезервовані: можна спробувати ще раз або обрати інший спосіб оплати.'
				}
			case 'REFUNDED':
				return {
					tone: 'neutral',
					title: 'Замовлення прийнято',
					description:
						'Кошти за цим замовленням повернено. Деталі надіслані на вашу електронну пошту.'
				}
			case 'PENDING':
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
		refetchInterval: query =>
			query.state.data?.payment_status === 'PENDING' && !pollingExpired
				? LIQPAY_POLL_INTERVAL_MS
				: false
	})
	const lookup = lookupQuery.data

	const retryMutation = useMutation({
		mutationFn: () => startLiqpayCheckout(raw ?? ''),
		onError: (err: Error) => {
			toast.error(err.message || 'Не вдалося перейти до оплати. Спробуйте ще раз.')
			// A 400 here usually means the order got PAID meanwhile (another tab, late
			// callback) — refresh the status so the card catches up.
			void lookupQuery.refetch()
		}
	})

	// Google Ads: offline methods convert on arrival, LiqPay only once the bank confirmed.
	const shouldConvert = isLiqpay ? lookup?.payment_status === 'PAID' : true
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

	// Offline methods carry totals in the URL; the LiqPay return does not, so fall back
	// to the amount the lookup reports.
	const displayTotal = hasTotal ? total : lookup?.total_price
	const hasDisplayTotal = displayTotal !== undefined && Number.isFinite(displayTotal)

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
					{view.tone === 'failed' && raw ? (
						<>
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
							<Button asChild variant='outline' className='w-full'>
								<Link href={UI_URLS.CONTACTS}>Обрати інший спосіб оплати</Link>
							</Button>
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

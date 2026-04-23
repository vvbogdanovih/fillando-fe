'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { UI_URLS } from '@/common/constants'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { formatOrderNumber } from '../checkout.schema'

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

	return (
		<div className='mx-auto max-w-lg px-4 py-12 md:py-20'>
			<Card className='border-primary/20'>
				<CardHeader className='text-center'>
					<div className='bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
						<CheckCircle2 className='text-primary h-9 w-9' />
					</div>
					<CardTitle className='text-2xl'>Дякуємо за замовлення!</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4 text-center'>
					{formatted ? (
						<p className='text-lg'>
							Номер замовлення:{' '}
							<span className='text-primary font-bold tabular-nums'>#{formatted}</span>
						</p>
					) : (
						<p className='text-muted-foreground text-sm'>
							Замовлення успішно прийнято.
						</p>
					)}
					<p className='text-muted-foreground text-sm leading-relaxed'>
						Реквізити для оплати будуть надіслані на вашу електронну пошту.
					</p>
					{hasTotal && (
						<div className='rounded-lg border p-3 text-left'>
							{hasDiscount && hasSubtotal && (
								<div className='mb-2 flex items-center justify-between text-sm'>
									<span className='text-muted-foreground'>Підсумок до знижки</span>
									<span>{subtotal.toLocaleString('uk-UA')} ₴</span>
								</div>
							)}
							{hasDiscount && (
								<div className='mb-2 flex items-center justify-between text-sm'>
									<span className='text-muted-foreground'>
										Знижка {discountCode ? `(${discountCode})` : ''}
										{Number.isFinite(discountPercent) ? ` ${discountPercent}%` : ''}
									</span>
									<span>-{discountAmount.toLocaleString('uk-UA')} ₴</span>
								</div>
							)}
							<div className='flex items-center justify-between text-base font-semibold'>
								<span>Разом</span>
								<span className='text-primary'>{total.toLocaleString('uk-UA')} ₴</span>
							</div>
						</div>
					)}
					<Button asChild className='mt-2 w-full'>
						<Link href={UI_URLS.CATALOG.FILAMENT}>Продовжити покупки</Link>
					</Button>
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

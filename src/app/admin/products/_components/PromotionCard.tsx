'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Input } from '@/common/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/common/components/ui/input-group'
import { Label } from '@/common/components/ui/label'
import { revalidateStorefront } from '@/common/services/revalidate.service'
import { formatAdminDateTime, fromDateTimeLocal } from '@/common/utils/date.utils'
import { productsApi } from '../products.api'
import {
	previewSalePrice,
	promoStateOf,
	type ProductVariantFull,
	type PromotionPayload
} from '../products.schema'

const PERCENT_RE = /^\d{1,2}$/

/**
 * One promotion for every variant of the product (TD-0012), in the same self-contained shape as
 * the order's «Знижка магазину»: local string state, one mutation, the server's answer written
 * straight into the variants query so the table below updates with it. Per-variant promotions are
 * edited in the variant modal; this card reports when they differ.
 */
export function PromotionCard({ productId }: { productId: string }) {
	const queryClient = useQueryClient()
	const [percent, setPercent] = useState('')
	const [endsAt, setEndsAt] = useState('')

	const { data: variants = [] } = useQuery({
		queryKey: ['variants', productId],
		queryFn: () => productsApi.getVariants(productId)
	})

	const mutation = useMutation({
		mutationFn: (body: PromotionPayload) => productsApi.setPromotion(productId, body),
		// Refusals (a date in the past, a percent out of range) arrive in Ukrainian — shown as is.
		onError: (error: Error) => toast.error(error.message || 'Не вдалося змінити акцію'),
		onSuccess: (updated, body) => {
			queryClient.setQueryData<ProductVariantFull[]>(['variants', productId], updated)
			setPercent('')
			setEndsAt('')
			toast.success(body.promo_percent === null ? 'Акцію прибрано' : 'Акцію застосовано')
			// Development only: production purges come from the backend.
			void revalidateStorefront('products')
		}
	})

	// Stored promo fields outlive the end date on purpose; only the live ones are «діє».
	const active = variants.filter(v => promoStateOf(v) === 'live')
	const ended = variants.filter(v => promoStateOf(v) === 'ended')
	const distinct = new Set(active.map(v => `${v.promo_percent}|${v.promo_ends_at ?? ''}`))
	const uniform = active.length > 0 && active.length === variants.length && distinct.size === 1

	const parsedPercent = Number(percent)
	const percentValid = PERCENT_RE.test(percent) && parsedPercent >= 1 && parsedPercent <= 90
	const endsAtDate = endsAt ? new Date(endsAt) : null
	const endsAtValid = !endsAt || (endsAtDate !== null && !Number.isNaN(endsAtDate.getTime()))
	const endsAtInPast = endsAtDate !== null && endsAtValid && endsAtDate.getTime() <= Date.now()
	const canApply =
		variants.length > 0 && percentValid && endsAtValid && !endsAtInPast && !mutation.isPending

	// The shop resells at supplier price + a small markup, so a promo easily dips below cost.
	// Named rather than blocked: it is the owner's call, but not one to make unknowingly.
	const belowCost = percentValid
		? variants.filter(
				v =>
					v.supplier_price != null &&
					previewSalePrice(v.price, parsedPercent) < v.supplier_price
			)
		: []

	const summary = (() => {
		if (variants.length === 0) return 'У товару ще немає варіантів.'
		if (active.length === 0) {
			if (ended.length === 0) return 'Акції немає.'
			const latest = ended
				.map(v => v.promo_ends_at as string)
				.sort()
				.at(-1) as string
			return `Акція завершилась ${formatAdminDateTime(latest)} — покупець бачить регулярну ціну.`
		}
		if (uniform) {
			const [first] = active
			return `Діє акція −${first.promo_percent} % на всі ${variants.length} варіант(и)${
				first.promo_ends_at ? `, до ${formatAdminDateTime(first.promo_ends_at)}` : ''
			}.`
		}
		return `Акція по варіантах: ${active.length} з ${variants.length}${
			distinct.size > 1 ? ' (різні умови)' : ''
		} — редагуйте у варіанті або застосуйте одну до всіх нижче.`
	})()

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<Card className='border-0 shadow-none'>
				<CardHeader className='p-0 pb-3'>
					<CardTitle className='text-sm font-semibold text-gray-900'>Акція</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3 p-0 text-sm'>
					<div className='flex flex-wrap items-center justify-between gap-2'>
						<p>{summary}</p>
						{(active.length > 0 || ended.length > 0) && (
							<Button
								variant='outline'
								disabled={mutation.isPending}
								onClick={() => mutation.mutate({ promo_percent: null })}
							>
								{active.length > 0 ? 'Прибрати акцію' : 'Очистити завершену акцію'}
							</Button>
						)}
					</div>

					<div className='grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end'>
						<div className='space-y-2'>
							<Label htmlFor='promotion-percent'>Знижка</Label>
							<InputGroup>
								<InputGroupInput
									id='promotion-percent'
									type='number'
									inputMode='numeric'
									min={1}
									max={90}
									value={percent}
									onChange={e => setPercent(e.target.value)}
									placeholder='15'
									aria-invalid={percent !== '' && !percentValid}
								/>
								<InputGroupAddon align='inline-end'>%</InputGroupAddon>
							</InputGroup>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='promotion-ends-at'>Діє до (необов’язково)</Label>
							<Input
								id='promotion-ends-at'
								type='datetime-local'
								value={endsAt}
								onChange={e => setEndsAt(e.target.value)}
								aria-invalid={!endsAtValid || endsAtInPast}
							/>
						</div>
						<Button
							disabled={!canApply}
							onClick={() =>
								mutation.mutate({
									promo_percent: parsedPercent,
									promo_ends_at: endsAt ? fromDateTimeLocal(endsAt) : null
								})
							}
						>
							Застосувати до всіх варіантів
						</Button>
					</div>

					{endsAtInPast && (
						<p className='text-xs text-amber-700'>
							Дата завершення має бути в майбутньому.
						</p>
					)}
					{belowCost.length > 0 && (
						<p
							role='status'
							className='rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800'
						>
							Нижче закупівлі:{' '}
							{belowCost
								.map(
									v =>
										`${v.sku} (≈${previewSalePrice(v.price, parsedPercent)} ₴ < ${v.supplier_price} ₴)`
								)
								.join(', ')}
							. Застосувати можна, але магазин продаватиме собі у збиток.
						</p>
					)}
					<p className='text-muted-foreground text-xs'>
						Відсоток знімається з регулярної ціни кожного варіанта; акційна ціна
						рахується при показі й не зберігається, тож синхронізація з Prom її не
						зачіпає. На вітрині — плашка «−N %», закреслена стара ціна і нова; у
						Google-фіді — sale_price. Купони на акційні товари не діють.
					</p>
				</CardContent>
			</Card>
		</section>
	)
}

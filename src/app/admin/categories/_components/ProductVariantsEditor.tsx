'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { colorsApi } from '@/app/admin/colors/colors.api'
import { swatchBackground } from '@/common/components/ColorSwatch'
import { pluralUk } from '@/common/utils/plural.utils'
import { previewSalePrice } from '../../products/products.schema'
import type { CategoryCommand } from '../category-tree.api'
import type { TypedDefinition, TypedProduct, TypedProductBody } from '../typed-product.schema'
import { productBody } from '../typed-product-body'
import { promoFields } from './ProductDetailsEditor'
import { problemText } from './product-drafts'
import { VariantDialog, type VariantTarget } from './VariantDialog'
import { ui } from './admin-ui'

const STATUS_LABELS = { active: 'Активний', draft: 'Чернетка', archived: 'Архівний' } as const
const STATUS_CLASSES = {
	active: 'border-green-200 bg-green-50 text-green-700',
	draft: 'border-gray-200 bg-gray-50 text-gray-600',
	archived: 'border-red-200 bg-red-50 text-red-700'
} as const
/** An axis value as the shop names it: an option label, Так/Ні, a number with its unit. */
function valueLabel(
	definition: TypedDefinition | undefined,
	value: string | number | boolean | null
) {
	if (value === null) return '—'
	if (definition?.value_type === 'enum')
		return definition.options.find(option => option.id === value)?.label ?? String(value)
	if (definition?.value_type === 'boolean') return value ? 'Так' : 'Ні'
	return `${value}${definition?.unit ? ` ${definition.unit}` : ''}`
}

/**
 * The SKUs of a product as the old admin listed them: one table row each, «Редагувати» opens the
 * whole SKU in one window ({@link VariantDialog}), «Додати варіант» the same window empty.
 */
export function ProductVariantsEditor({
	product,
	disabled,
	message = '',
	onSubmit
}: {
	product: TypedProduct
	disabled: boolean
	/** The page's status line, repeated in the variant window when its save is refused. */
	message?: string
	onSubmit: (command: CategoryCommand) => void
}) {
	const [dialog, setDialog] = useState<VariantTarget | null>(null)
	// Two-step actions: a SKU's id, 'product' or 'archive' waiting for its «Так, …».
	const [confirming, setConfirming] = useState<string | null>(null)
	const [error, setError] = useState('')
	const published = product.published === true
	const axis = product.definitions.find(item => item.key === product.variant_axis?.key)
	const details = new Map(product.details?.variants.map(row => [row.id, row]) ?? [])
	function send(action: NonNullable<TypedProductBody['variant_action']>) {
		setError('')
		try {
			onSubmit({
				type: 'product',
				id: product.product_id,
				body: productBody(product, { variant_action: action })
			})
		} catch (cause) {
			setError(problemText(cause, 'Перевірте дані варіанта.'))
		}
	}
	const active = product.variants.filter(row => row.status === 'active').length
	const anyActive = active > 0
	return (
		<section aria-label='Варіанти' className={`${ui.card} @container`}>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<div className='flex items-center gap-2'>
					<h3 className={ui.cardTitle}>Варіанти</h3>
					<span className={`${ui.badge} bg-gray-100 text-gray-700`}>
						{product.variants.length}
					</span>
				</div>
				<button
					type='button'
					className={ui.primary}
					disabled={disabled || !axis || product.variants.length >= 100}
					onClick={() => setDialog({ mode: 'add' })}
				>
					<PlusIcon className='size-4' aria-hidden />
					Додати варіант
				</button>
			</div>
			<p className={ui.hint}>
				{published
					? 'Товар опубліковано: збережені зміни одразу видно на сайті. Архівний варіант лишається доступним за адресою, але не продається.'
					: 'Категорія в чернетці: зміни не видно на сайті. Архівування зберігає артикул, адресу та історію.'}
				{!axis &&
					' Щоб додати варіант, спочатку оберіть і збережіть вісь у характеристиках товару.'}
			</p>
			<fieldset disabled={disabled} className='min-w-0'>
				<div className='-mx-5 overflow-x-auto px-5'>
					<table className='w-full min-w-[720px] text-sm'>
						<thead>
							<tr className='border-b border-gray-200 text-left text-xs font-medium text-gray-500'>
								<th className='py-2 pr-3'>#</th>
								<th className='py-2 pr-3'>{axis?.label ?? 'Варіант'}</th>
								<th className='py-2 pr-3'>Артикул</th>
								<th className='py-2 pr-3'>Артикул вендора</th>
								<th className='py-2 pr-3'>Ціна</th>
								<th className='py-2 pr-3'>Залишок</th>
								<th className='py-2 pr-3'>Вага</th>
								<th className='py-2 pr-3'>Статус</th>
								<th className='py-2 pr-3'>Фото</th>
								<th className='py-2'>
									<span className='sr-only'>Дії</span>
								</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-gray-100'>
							{product.variants.map((row, index) => {
								const detail = details.get(row.id)
								const status = row.status ?? 'draft'
								const promo = detail ? promoFields(detail) : null
								const removable = status !== 'active' && product.variants.length > 1
								return [
									<tr key={row.id} className='align-middle hover:bg-gray-50'>
										<td className='py-2.5 pr-3 text-xs text-gray-400'>
											{index + 1}
										</td>
										<td className='py-2.5 pr-3'>
											{axis?.semantic === 'color' ? (
												<ColorValue value={row.variant_value} />
											) : (
												<span className='font-medium text-gray-900'>
													{valueLabel(axis, row.variant_value)}
												</span>
											)}
										</td>
										<td className='py-2.5 pr-3 font-mono text-xs whitespace-nowrap text-gray-700'>
											<a
												className='hover:underline'
												href={`/products/${row.slug}`}
												target='_blank'
												rel='noreferrer'
												title={`/products/${row.slug}`}
											>
												{row.sku}
											</a>
										</td>
										<td className='py-2.5 pr-3 font-mono text-xs whitespace-nowrap text-gray-700'>
											{detail?.vendor_product_sku || '—'}
										</td>
										<td className='py-2.5 pr-3 whitespace-nowrap text-gray-700'>
											{detail && promo?.promo_percent ? (
												<span className='flex flex-wrap items-center gap-1.5'>
													<s className='text-gray-400'>
														{detail.price} ₴
													</s>
													<span className='font-medium text-red-700'>
														{previewSalePrice(
															detail.price,
															Number(promo.promo_percent)
														)}{' '}
														₴
													</span>
													<span
														className={`${ui.badge} bg-red-50 text-red-700`}
													>
														−{promo.promo_percent}%
													</span>
												</span>
											) : detail ? (
												`${detail.price} ₴`
											) : (
												'—'
											)}
										</td>
										<td className='py-2.5 pr-3 whitespace-nowrap text-gray-700'>
											{detail?.stock ?? '—'}
										</td>
										<td className='py-2.5 pr-3 whitespace-nowrap text-gray-700'>
											{detail?.weight_g ? `${detail.weight_g} г` : '—'}
										</td>
										<td className='py-2.5 pr-3'>
											<span
												className={`${ui.badge} border ${STATUS_CLASSES[status]}`}
											>
												{STATUS_LABELS[status]}
											</span>
										</td>
										<td className='py-2.5 pr-3'>
											{detail?.images.length ? (
												<span className='flex items-center gap-1.5'>
													<img
														src={detail.images[0]}
														alt=''
														className='size-8 rounded object-cover'
													/>
													{detail.images.length > 1 && (
														<span className='text-xs text-gray-400'>
															+{detail.images.length - 1}
														</span>
													)}
												</span>
											) : (
												<span className='text-xs text-gray-400'>—</span>
											)}
										</td>
										<td className='py-2.5'>
											<span className='flex items-center justify-end gap-1'>
												<button
													type='button'
													className={`${ui.button} gap-1.5 px-2.5`}
													aria-label={`Редагувати ${row.sku}`}
													title='Редагувати'
													onClick={() =>
														setDialog({ mode: 'edit', id: row.id })
													}
												>
													<PencilIcon className='size-3.5' aria-hidden />
													<span className='hidden @5xl:inline'>
														Редагувати
													</span>
												</button>
												{!published && (
													<button
														type='button'
														className={`${ui.button} gap-1.5 px-2.5`}
														aria-label={`${status === 'archived' ? 'Відновити' : 'Архівувати'} ${row.sku}`}
														title={
															status === 'archived'
																? 'Відновити'
																: 'Архівувати'
														}
														onClick={() =>
															send({
																type:
																	status === 'archived'
																		? 'restore'
																		: 'archive',
																id: row.id
															})
														}
													>
														{status === 'archived' ? (
															<ArchiveRestoreIcon
																className='size-3.5'
																aria-hidden
															/>
														) : (
															<ArchiveIcon
																className='size-3.5'
																aria-hidden
															/>
														)}
														<span className='hidden @5xl:inline'>
															{status === 'archived'
																? 'Відновити'
																: 'Архівувати'}
														</span>
													</button>
												)}
												{removable && (
													<button
														type='button'
														className={`${ui.button} px-2 text-red-600 hover:bg-red-50 hover:text-red-700`}
														aria-label={`Видалити ${row.sku}`}
														title='Видалити'
														onClick={() => setConfirming(row.id)}
													>
														<Trash2Icon
															className='size-3.5'
															aria-hidden
														/>
													</button>
												)}
											</span>
										</td>
									</tr>,
									confirming === row.id && (
										<tr key={`${row.id}:confirm`} className='bg-red-50'>
											<td colSpan={10} className='px-3 py-2'>
												<span className='flex flex-wrap items-center justify-end gap-2 text-sm'>
													<span className='mr-auto text-red-800'>
														Варіант {row.sku} буде видалено назавжди.
													</span>
													<button
														type='button'
														className={ui.button}
														onClick={() => setConfirming(null)}
													>
														Скасувати
													</button>
													<button
														type='button'
														className={`${ui.button} border-red-300 text-red-700 hover:bg-red-50`}
														onClick={() => {
															setConfirming(null)
															send({ type: 'delete', id: row.id })
														}}
													>
														Так, видалити {row.sku} назавжди
													</button>
												</span>
											</td>
										</tr>
									)
								]
							})}
						</tbody>
					</table>
				</div>
				<div className='mt-4 flex flex-wrap items-center gap-2 border-t pt-4'>
					<p className='mr-auto text-xs text-gray-500'>
						Видалити можна лише чернетку чи архівний варіант, якого не продавали й немає
						в кошиках; інакше — архівуйте.
					</p>
					<button
						type='button'
						className={ui.button}
						disabled={
							confirming === 'archive' ||
							!product.variants.some(row => row.status !== 'archived')
						}
						onClick={() => setConfirming('archive')}
					>
						Архівувати всі варіанти
					</button>
					<button
						type='button'
						className={`${ui.button} text-red-700`}
						disabled={anyActive || confirming === 'product'}
						title={anyActive ? 'Спершу архівуйте всі варіанти' : undefined}
						onClick={() => setConfirming('product')}
					>
						Видалити товар
					</button>
				</div>
				{(confirming === 'archive' || confirming === 'product') && (
					// On a row of its own, the first button left in place and switched off: a double
					// click must not land on the confirmation.
					<div className='mt-2 flex flex-wrap items-center justify-end gap-2 rounded-md bg-red-50 px-3 py-2 text-sm'>
						<span className='mr-auto text-red-800'>
							{confirming === 'product'
								? 'Товар буде видалено назавжди разом з його варіантами.'
								: published && active
									? `${pluralUk(
											active,
											`${active} активний варіант зникне`,
											`${active} активні варіанти зникнуть`,
											`${active} активних варіантів зникнуть`
										)} з продажу на сайті. Повернути кожен можна лише окремо — у вікні «Редагувати».`
									: 'Усі варіанти стануть архівними. На сайті вони зараз не продаються.'}
						</span>
						<button
							type='button'
							className={ui.button}
							onClick={() => setConfirming(null)}
						>
							Скасувати
						</button>
						<button
							type='button'
							className={`${ui.button} border-red-300 text-red-700 hover:bg-red-50`}
							onClick={() => {
								setConfirming(null)
								if (confirming === 'archive') send({ type: 'archive_all' })
								else
									onSubmit({
										type: 'product-delete',
										id: product.product_id,
										body: { expected_revision: product.revision }
									})
							}}
						>
							{confirming === 'archive'
								? 'Так, архівувати всі варіанти'
								: `Так, видалити «${product.name}» назавжди`}
						</button>
					</div>
				)}
			</fieldset>
			{error && (
				<p role='alert' className='break-words text-red-700'>
					{error}
				</p>
			)}
			{dialog && (
				<VariantDialog
					key={dialog.mode === 'edit' ? dialog.id : 'add'}
					product={product}
					target={dialog}
					disabled={disabled}
					failure={message}
					onClose={() => setDialog(null)}
					onSubmit={onSubmit}
				/>
			)}
		</section>
	)
}

/** A colour-axis value: the dictionary colour's swatch and name («Чорний (Black)»). */
function ColorValue({ value }: { value: string | number | boolean | null }) {
	const colors = useQuery({ queryKey: ['colors-admin'], queryFn: colorsApi.getAll })
	const color = colors.data?.find(item => item._id === String(value))
	return (
		<span className='flex items-center gap-2 font-medium text-gray-900'>
			<span
				aria-hidden
				className='size-4 shrink-0 rounded-full border border-gray-300'
				style={{
					background: color ? swatchBackground(color.hex_stops, color.family) : undefined
				}}
			/>
			{color
				? color.name_uk === color.name_en
					? color.name_uk
					: `${color.name_uk} (${color.name_en})`
				: value === null
					? '—'
					: String(value)}
		</span>
	)
}

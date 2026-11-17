'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ValueInput } from './TypedValueInput'
import { categoryTreeApi, type CategoryCommand } from '../category-tree.api'
import { CatalogChangedError, categoryError } from '../category-tree.utils'
import { parseField, type TransferPreview, type TypedDefinition } from '../typed-product.schema'
import { pluralUk } from '@/common/utils/plural.utils'
import { ui } from './admin-ui'

const button = ui.button
const reasons: Record<TransferPreview['dropped'][number]['reason'], string> = {
	no_target: 'немає в цільовій категорії',
	type: 'інший тип або одиниця',
	multiple: 'у цільовій категорії лише одне значення',
	axis: 'там це вісь варіантів'
}
const axisProblems: Record<NonNullable<TransferPreview['axis_problem']>, string> = {
	AXIS_NO_TARGET: 'у цільовій категорії немає характеристики для осі варіантів цього товару',
	AXIS_TYPE:
		'вісь варіантів у цільовій категорії іншого типу (колір зі словника ↔ звичайне значення)',
	AXIS_VALUES:
		'значення варіантів не можна виразити в цільовій категорії без втрат або дублікатів'
}

export interface TransferTarget {
	id: string
	name: string
	status: 'draft' | 'active'
}

/** The stored value as an admin reads it (enum label, Так/Ні, number with unit). */
function valueText(definition: TypedDefinition | undefined, value: string | number | boolean) {
	if (!definition) return String(value)
	if (definition.value_type === 'enum')
		return definition.options.find(option => option.id === value)?.label ?? String(value)
	if (typeof value === 'boolean') return value ? 'Так' : 'Ні'
	return definition.unit ? `${value} ${definition.unit}` : String(value)
}

/**
 * Moving a product to another category (Plan-0010 F04). The server proposes what is carried over;
 * the admin sees what is lost and what the target still needs, and confirms. URLs, SKU codes and
 * prices stay; a draft target turns active variants into drafts.
 */
export function ProductTransferPanel({
	productId,
	targets,
	revision,
	disabled,
	onSubmit
}: {
	productId: string
	targets: TransferTarget[]
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [opened, setOpened] = useState(false)
	const [target, setTarget] = useState('')
	return (
		<section className={ui.card} aria-label='Перенесення товару'>
			<button
				type='button'
				className={button}
				aria-expanded={opened}
				onClick={() => setOpened(!opened)}
			>
				Перенести в іншу категорію
			</button>
			{opened && (
				<>
					{!targets.length ? (
						<p className='text-sm text-gray-500'>
							Немає інших товарних категорій нового каталогу, куди можна перенести
							товар.
						</p>
					) : (
						<label className='block text-sm'>
							Цільова категорія
							<select
								className={ui.input}
								value={target}
								onChange={event => setTarget(event.target.value)}
							>
								<option value=''>Оберіть категорію</option>
								{targets.map(item => (
									<option key={item.id} value={item.id}>
										{item.name} (
										{item.status === 'active' ? 'опублікована' : 'чернетка'})
									</option>
								))}
							</select>
						</label>
					)}
					{target && (
						<TransferPreviewForm
							key={`${target}:${revision}`}
							productId={productId}
							targetId={target}
							revision={revision}
							disabled={disabled}
							onSubmit={onSubmit}
						/>
					)}
				</>
			)}
		</section>
	)
}

function TransferPreviewForm({
	productId,
	targetId,
	revision,
	disabled,
	onSubmit
}: {
	productId: string
	targetId: string
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const preview = useQuery({
		queryKey: ['typed-product-transfer', productId, targetId, revision],
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await categoryTreeApi.transferPreview(productId, targetId)
			if (result.revision !== revision) throw new CatalogChangedError()
			return result
		}
	})
	const [values, setValues] = useState<Record<string, string>>({})
	const [confirmed, setConfirmed] = useState(false)
	const [error, setError] = useState('')
	if (preview.isLoading) return <p className='text-sm'>Перевірка перенесення…</p>
	if (preview.error) return <p role='alert'>{categoryError(preview.error).message}</p>
	const plan = preview.data!
	const definitions = new Map(plan.target.definitions.map(item => [item.key, item]))
	const published = plan.target.status === 'active'
	const missing = plan.missing_required.map(key => definitions.get(key)!).filter(Boolean)
	const blocked = Boolean(plan.axis_problem) || (plan.dropped.length > 0 && !confirmed)
	const submit = () => {
		setError('')
		try {
			const filled = missing.flatMap(definition => {
				const value = parseField(definition, values[definition.key] ?? '')
				if (value === null) {
					if (published)
						throw Error(
							`Заповніть «${definition.label}»: вона обов’язкова в цільовій категорії`
						)
					return []
				}
				return [{ k: definition.key, v: value }]
			})
			onSubmit({
				type: 'transfer',
				id: productId,
				body: {
					expected_revision: revision,
					target_category_id: targetId,
					attributes_v2: [...plan.proposal.attributes_v2, ...filled],
					variant_axis: plan.proposal.variant_axis,
					variants: plan.proposal.variants,
					confirm_dropped: plan.dropped.map(row => row.key)
				}
			})
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : 'Перевірте значення.')
		}
	}
	return (
		<div
			className='space-y-3 text-sm'
			role='group'
			aria-label='Результат перевірки перенесення'
		>
			<p>
				«{plan.name}»: {plan.source.name} → {plan.target.name}. Адреси сторінок, артикули,
				ціни й залишки не змінюються.
			</p>
			{plan.axis_problem && (
				<p role='alert' className='text-red-700'>
					Перенесення неможливе: {axisProblems[plan.axis_problem]}.
				</p>
			)}
			{plan.mapped.length > 0 && (
				<div>
					<p className='font-medium'>Переноситься</p>
					<ul className='list-disc pl-5'>
						{plan.mapped.map(row => (
							<li key={`${row.source_key}:${String(row.value)}`}>
								{row.target_label}:{' '}
								{valueText(definitions.get(row.target_key), row.value)}
							</li>
						))}
					</ul>
				</div>
			)}
			{plan.dropped.length > 0 && (
				<div>
					<p className='font-medium text-red-700'>Буде втрачено</p>
					<ul className='list-disc pl-5'>
						{plan.dropped.map(row => (
							<li key={`${row.key}:${String(row.value)}`}>
								{row.label}: {row.value_label} — {reasons[row.reason]}
							</li>
						))}
					</ul>
					<label className='mt-2 flex items-center gap-2'>
						<input
							type='checkbox'
							checked={confirmed}
							onChange={event => setConfirmed(event.target.checked)}
						/>
						Підтверджую втрату цих значень
					</label>
				</div>
			)}
			{missing.length > 0 && (
				<div className='space-y-2'>
					<p className='font-medium'>
						{published
							? 'Обов’язкові в цільовій категорії — заповніть перед перенесенням'
							: 'Обов’язкові для публікації в цільовій категорії — можна заповнити пізніше'}
					</p>
					{missing.map(definition => (
						<ValueInput
							key={definition.key}
							definition={definition}
							label={
								definition.unit
									? `${definition.label} (${definition.unit})`
									: definition.label
							}
							value={values[definition.key] ?? ''}
							onChange={value =>
								setValues(current => ({ ...current, [definition.key]: value }))
							}
						/>
					))}
				</div>
			)}
			{plan.variants_to_draft > 0 && (
				<p>
					Цільова категорія не опублікована:{' '}
					{pluralUk(
						plan.variants_to_draft,
						`${plan.variants_to_draft} активний варіант стане чернеткою й зникне`,
						`${plan.variants_to_draft} активні варіанти стануть чернетками й зникнуть`,
						`${plan.variants_to_draft} активних варіантів стануть чернетками й зникнуть`
					)}{' '}
					із сайту.
				</p>
			)}
			{error && <p role='alert'>{error}</p>}
			<button
				type='button'
				className={button}
				disabled={disabled || blocked || preview.isFetching}
				onClick={submit}
			>
				Перенести товар
			</button>
		</div>
	)
}

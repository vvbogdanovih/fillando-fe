'use client'
import { ui } from './admin-ui'
import { useState } from 'react'
import { categoryTreeApi, type FilterPreview, type PreviewFilter } from '../category-tree.api'
import type { CategoryConfiguration } from '../category-definitions.schema'
export function CategoryFilterPreview({
	config,
	disabled
}: {
	config: CategoryConfiguration
	disabled: boolean
}) {
	const [values, setValues] = useState<Record<string, (string | number | boolean)[]>>({})
	const [ranges, setRanges] = useState<Record<string, { min: string; max: string }>>({})
	const [texts, setTexts] = useState<Record<string, string>>({})
	const [result, setResult] = useState<FilterPreview | null>(null),
		[error, setError] = useState(''),
		[loading, setLoading] = useState(false)
	async function preview() {
		setLoading(true)
		setError('')
		setResult(null)
		try {
			const filters: PreviewFilter[] = []
			for (const definition of config.controls.filters) {
				if (definition.filter_type === 'range') {
					const range = ranges[definition.key]
					if (range?.min || range?.max) {
						const min = range.min === '' ? undefined : Number(range.min),
							max = range.max === '' ? undefined : Number(range.max)
						if (
							(min !== undefined && !Number.isFinite(min)) ||
							(max !== undefined && !Number.isFinite(max)) ||
							(min !== undefined && max !== undefined && min > max)
						)
							throw Error('Перевірте межі числового діапазону.')
						filters.push({
							key: definition.key,
							...(min === undefined ? {} : { min }),
							...(max === undefined ? {} : { max })
						})
					}
				} else {
					let selected = values[definition.key] ?? []
					if (definition.value_type === 'string' || definition.value_type === 'number') {
						selected = (texts[definition.key] ?? '')
							.split('\n')
							.map(value => value.trim())
							.filter(Boolean)
							.map(value =>
								definition.value_type === 'number' ? Number(value) : value
							)
						if (
							selected.some(
								value => typeof value === 'number' && !Number.isFinite(value)
							)
						)
							throw Error('Введіть коректні числові значення.')
					}
					if (selected.length) filters.push({ key: definition.key, values: selected })
				}
			}
			const response = await categoryTreeApi.filterPreview(config.category_id, filters)
			if (response.revision !== config.revision)
				throw Error('Каталог змінився. Оновіть дерево перед перевіркою.')
			setResult(response)
		} catch (error) {
			const failure = error as { details?: { details?: { code?: string } }; message?: string }
			setError(
				failure.details?.details?.code === 'CATALOG_PREVIEW_DATA_UNAVAILABLE'
					? 'Товари категорії ще не підготовлені до нового формату. Порожній результат не підставляється.'
					: failure.message || 'Не вдалося перевірити фільтри.'
			)
		} finally {
			setLoading(false)
		}
	}
	return (
		<details className='rounded-lg border border-gray-200 bg-white p-3'>
			<summary className='cursor-pointer font-medium text-gray-900'>
				Перевірити фільтри на товарах
			</summary>
			<p className='my-3 text-sm text-gray-500'>
				Оберіть значення фільтрів і подивіться, скільки товарів категорії знайдеться —
				чернетки теж. Нічого не змінює й не публікує.
			</p>
			{disabled && (
				<p className='text-sm'>Спочатку збережіть або скасуйте зміни характеристик.</p>
			)}
			<fieldset disabled={disabled || loading} className='space-y-3'>
				{config.controls.filters.map(definition => (
					<div key={definition.key} className='rounded border p-2'>
						<p className='text-sm font-medium'>
							{definition.label}
							{definition.unit ? ` (${definition.unit})` : ''}
						</p>
						{definition.filter_type === 'range' ? (
							<div className='flex gap-2'>
								{(['min', 'max'] as const).map(bound => (
									<label className='min-w-0 flex-1 text-sm' key={bound}>
										{bound === 'min' ? 'Від' : 'До'}
										<input
											aria-label={`${definition.label}: ${bound === 'min' ? 'від' : 'до'}`}
											className={ui.input}
											type='number'
											step='any'
											value={ranges[definition.key]?.[bound] ?? ''}
											onChange={event => {
												setResult(null)
												setRanges(previous => ({
													...previous,
													[definition.key]: {
														...(previous[definition.key] ?? {
															min: '',
															max: ''
														}),
														[bound]: event.target.value
													}
												}))
											}}
										/>
									</label>
								))}
							</div>
						) : definition.value_type === 'enum' ||
						  definition.value_type === 'boolean' ? (
							<div className='flex flex-wrap gap-3'>
								{(definition.value_type === 'boolean'
									? [
											{ id: true, label: 'Так' },
											{ id: false, label: 'Ні' }
										]
									: definition.options
								).map(option => (
									<label className='text-sm' key={String(option.id)}>
										<input
											type='checkbox'
											checked={(values[definition.key] ?? []).includes(
												option.id
											)}
											onChange={event => {
												setResult(null)
												setValues(previous => ({
													...previous,
													[definition.key]: event.target.checked
														? [
																...(previous[definition.key] ?? []),
																option.id
															]
														: (previous[definition.key] ?? []).filter(
																value => value !== option.id
															)
												}))
											}}
										/>{' '}
										{option.label}
									</label>
								))}
							</div>
						) : (
							<label className='block text-sm'>
								Кожне значення — з нового рядка; кома є частиною значення
								<textarea
									className={ui.textarea}
									aria-label={`Значення: ${definition.label}`}
									value={texts[definition.key] ?? ''}
									onChange={event => {
										setResult(null)
										setTexts(previous => ({
											...previous,
											[definition.key]: event.target.value
										}))
									}}
								/>
							</label>
						)}
					</div>
				))}
				<button
					className='rounded border px-3 py-2 text-sm disabled:opacity-50'
					onClick={() => void preview()}
				>
					{loading ? 'Перевірка…' : 'Перевірити на товарах'}
				</button>
			</fieldset>
			{error && (
				<p role='alert' className='mt-3 text-sm text-red-700'>
					{error}
				</p>
			)}
			{result && (
				<div className='mt-3 space-y-2' role='status'>
					<p>
						Знайдено варіантів: <strong>{result.total_variants}</strong>. Товарів:{' '}
						<strong>{result.total_products}</strong>.
					</p>
					{result.facets.map(facet => {
						const definition = config.definitions.find(
							value => value.key === facet.key
						)!
						return (
							<div key={facet.key} className='text-sm'>
								<strong>{definition.label}:</strong>{' '}
								{definition.filter_type === 'range'
									? facet.min === null
										? 'немає числових значень'
										: `${facet.min} — ${facet.max}${definition.unit ? ` ${definition.unit}` : ''}`
									: facet.values.length
										? facet.values
												.map(
													value =>
														`${definition.options.find(option => option.id === value.value)?.label ?? (typeof value.value === 'boolean' ? (value.value ? 'Так' : 'Ні') : String(value.value))}: ${value.count}`
												)
												.join('; ')
										: 'немає значень'}
							</div>
						)
					})}
				</div>
			)}
		</details>
	)
}

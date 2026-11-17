'use client'
import { useState } from 'react'
import type { CategoryCommand } from '../category-tree.api'
import { ui } from './admin-ui'

const button = ui.button

/**
 * Redirect-backed address change (Plan-0010 B07/F05): an ordinary rename never changes a URL; this
 * does, and the old address keeps answering one permanent redirect to the new one.
 */
export function SlugChange({
	target,
	id,
	slug,
	prefix,
	revision,
	disabled,
	onSubmit
}: {
	target: 'variants' | 'categories' | 'landings'
	id: string
	slug: string
	/** The address up to the slug, e.g. `/products/` or `/filament/`. */
	prefix: string
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [opened, setOpened] = useState(false)
	const [value, setValue] = useState(slug)
	const [error, setError] = useState('')
	if (!opened)
		return (
			<button
				type='button'
				className={button}
				disabled={disabled}
				aria-label={`Змінити адресу ${prefix}${slug}`}
				onClick={() => setOpened(true)}
			>
				Змінити адресу
			</button>
		)
	return (
		<div
			className='w-full space-y-2 rounded border bg-gray-50 p-3 text-sm'
			role='group'
			aria-label={`Нова адреса для ${prefix}${slug}`}
		>
			<label className='block'>
				Нова адреса ({prefix}…)
				<input
					className={ui.input}
					value={value}
					onChange={event => setValue(event.target.value.trim())}
					// Inside a landing's form Enter would submit that form — a save of the landing,
					// not this address change. The change has its own button.
					onKeyDown={event => {
						if (event.key === 'Enter') event.preventDefault()
					}}
				/>
			</label>
			<p className='text-xs text-gray-500'>
				Стара адреса {prefix}
				{slug} назавжди перенаправлятиме на нову (301). Посилання в рекламі й пошуку не
				загубляться.
			</p>
			{error && <p role='alert'>{error}</p>}
			<div className='flex gap-2'>
				<button
					type='button'
					className={button}
					disabled={disabled}
					onClick={() => {
						if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
							return setError('Адреса: малі латинські літери, цифри й дефіс.')
						if (value === slug) return setError('Адреса вже така.')
						onSubmit({
							type: 'slug',
							target,
							id,
							body: { slug: value, expected_revision: revision }
						})
					}}
				>
					Змінити з перенаправленням
				</button>
				<button type='button' className={button} onClick={() => setOpened(false)}>
					Скасувати
				</button>
			</div>
		</div>
	)
}

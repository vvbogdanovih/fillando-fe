import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, expect, it } from 'vitest'
import type { CategoryCommand } from '../category-tree.api'
import {
	CategoryDraftsProvider,
	useCategoryDraft,
	useCategorySave,
	type DetailsDraft
} from './category-drafts'

const id = '000000000000000000000001'

/** One block and the header's two moments: the command is built, then its answer arrives. */
function Block() {
	const [details, setDetails] = useCategoryDraft<DetailsDraft>(id, 'details', {
		name: 'Дім',
		image: null
	})
	const save = useCategorySave(id)
	const sent = useRef<CategoryCommand | null>(null)
	return (
		<>
			<input
				aria-label='Назва'
				value={details.name}
				onChange={event => setDetails({ ...details, name: event.target.value })}
			/>
			<p>{save.unsaved.length ? 'не збережено' : 'збережено'}</p>
			<button
				onClick={() => {
					const commands = save.prepare(7)
					if (Array.isArray(commands)) sent.current = commands[0].command
				}}
			>
				надіслати
			</button>
			<button onClick={() => sent.current && save.saved(sent.current)}>підтверджено</button>
		</>
	)
}
const mount = () =>
	render(
		<CategoryDraftsProvider>
			<Block />
		</CategoryDraftsProvider>
	)
const type = (value: string) =>
	fireEvent.change(screen.getByLabelText('Назва'), { target: { value } })
afterEach(cleanup)

it('settles a block when its command is confirmed — by what was sent, not by the raw text', () => {
	mount()
	// The name goes trimmed: the draft with its trailing space is exactly what the command holds.
	type('Дім і сад ')
	expect(screen.getByText('не збережено')).toBeVisible()
	fireEvent.click(screen.getByRole('button', { name: 'надіслати' }))
	fireEvent.click(screen.getByRole('button', { name: 'підтверджено' }))
	expect(screen.getByText('збережено')).toBeVisible()
})

it('keeps what was typed while the command was on its way', () => {
	mount()
	type('Дім і сад')
	fireEvent.click(screen.getByRole('button', { name: 'надіслати' }))
	type('Дім, сад і город')
	fireEvent.click(screen.getByRole('button', { name: 'підтверджено' }))
	// The answer is about the older text: the newer one is still unsaved, and still on screen.
	expect(screen.getByText('не збережено')).toBeVisible()
	expect(screen.getByLabelText('Назва')).toHaveValue('Дім, сад і город')
})

it('names the block that cannot be sent, for a header that may not have it in sight', () => {
	const prepared: unknown[] = []
	function Probe() {
		const save = useCategorySave(id)
		return <button onClick={() => prepared.push(save.prepare(7))}>перевірити</button>
	}
	render(
		<CategoryDraftsProvider>
			<Block />
			<Probe />
		</CategoryDraftsProvider>
	)
	type('   ')
	fireEvent.click(screen.getByRole('button', { name: 'перевірити' }))
	expect(prepared).toEqual([
		{ refused: [{ label: 'Назва й зображення', message: 'Вкажіть назву категорії.' }] }
	])
})

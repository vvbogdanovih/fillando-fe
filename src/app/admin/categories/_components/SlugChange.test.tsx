import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SlugChange } from './SlugChange'
afterEach(cleanup)

it('validates the new address and sends a redirect-backed change', () => {
	const submit = vi.fn()
	render(
		<SlugChange
			target='variants'
			id='000000000000000000000020'
			slug='pla-black'
			prefix='/products/'
			revision={9}
			disabled={false}
			onSubmit={submit}
		/>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Змінити адресу /products/pla-black' }))
	expect(screen.getByText(/назавжди перенаправлятиме на нову/)).toBeInTheDocument()
	const field = screen.getByRole('textbox', { name: /^Нова адреса/ })
	fireEvent.change(field, { target: { value: 'PLA Black' } })
	fireEvent.click(screen.getByRole('button', { name: 'Змінити з перенаправленням' }))
	expect(screen.getByRole('alert')).toHaveTextContent('малі латинські літери')
	fireEvent.change(field, { target: { value: 'pla-black-matte' } })
	fireEvent.click(screen.getByRole('button', { name: 'Змінити з перенаправленням' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'slug',
		target: 'variants',
		id: '000000000000000000000020',
		body: { slug: 'pla-black-matte', expected_revision: 9 }
	})
})

it('keeps Enter in the address field from submitting the form around it', () => {
	const save = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
	const submit = vi.fn()
	render(
		// As in the landing form, where the address change sits among the landing's own fields.
		<form onSubmit={save}>
			<SlugChange
				target='landings'
				id='000000000000000000000020'
				slug='pla'
				prefix='/filament/'
				revision={9}
				disabled={false}
				onSubmit={submit}
			/>
			<button type='submit'>Зберегти сторінку</button>
		</form>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Змінити адресу /filament/pla' }))
	const field = screen.getByRole('textbox', { name: /^Нова адреса/ })
	fireEvent.change(field, { target: { value: 'pla-new' } })
	// `false`: the key's default — the browser's implicit submit of the form — was cancelled.
	expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false)
	expect(save).not.toHaveBeenCalled()
	expect(submit).not.toHaveBeenCalled()
})

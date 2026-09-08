import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorForm } from './ColorForm'
import type { Color } from '../colors.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// The dialog only writes on submit, and no test here submits.
vi.mock('../colors.api', () => ({ colorsApi: { create: vi.fn(), update: vi.fn() } }))

const GREEN: Color = {
	_id: 'c1',
	name_en: 'Bambu Green',
	name_uk: 'Зелений Bambu',
	slug: 'bambu-green',
	family: 'green',
	hex_stops: ['#00AE42'],
	order: 55
}

const renderDialog = (initial: Color | null = GREEN) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<ColorForm initial={initial} onClose={vi.fn()} />
		</QueryClientProvider>
	)
}

describe('ColorForm — what the family select has to say', () => {
	/** I-28: the artboard's sentence under the select. */
	it('says the family is one of fifteen and that it is what filters', () => {
		renderDialog()

		expect(screen.getByText('Одна з 15 родин — саме вона стає фільтром.')).toBeInTheDocument()
	})

	/**
	 * The warning existed only in the paragraph above the table — another screen entirely, while
	 * the bulk write with no undo is triggered from this select.
	 */
	it('warns that changing it rewrites the family on every variant of the colour', () => {
		renderDialog()

		expect(
			screen.getByText(
				'Зміна родини одразу перезаписує її на всіх варіантах товарів із цим кольором.'
			)
		).toBeInTheDocument()
	})

	/** I-34: a <Label> bound to nothing left the trigger announcing only «Зелені». */
	it('gives the select an accessible name', () => {
		renderDialog()

		expect(screen.getByRole('combobox', { name: 'Родина' })).toBeInTheDocument()
	})
})

describe('ColorForm — the hint under the stops', () => {
	it('promises a solid circle for one stop', () => {
		renderDialog()

		expect(screen.getByText(/суцільний кружечок/)).toBeInTheDocument()
	})

	/**
	 * `swatchBackground` checks the transparent family *before* the stop count, so the preview
	 * beside this hint draws a checkerboard however many stops there are — and «Один колір —
	 * суцільний кружечок» described a swatch that is nowhere on screen.
	 */
	it('describes the checkerboard instead for the transparent family', () => {
		renderDialog({ ...GREEN, family: 'transparent' })

		expect(
			screen.getByText(
				/Родина «Прозорі» малюється шаховим візерунком незалежно від кількості кольорів\./
			)
		).toBeInTheDocument()
		expect(screen.queryByText(/суцільний кружечок/)).not.toBeInTheDocument()
	})

	it('still names the gradients for the other families', () => {
		renderDialog({ ...GREEN, family: 'multicolor', hex_stops: ['#00AE42', '#189BDC'] })

		expect(screen.getByText(/конічний градієнт/)).toBeInTheDocument()
	})
})

describe('ColorForm — the stop rows', () => {
	/** I-34: `title` alone made all three buttons of every row read the same. */
	it('names the reorder and delete buttons after the stop they act on', () => {
		renderDialog({ ...GREEN, hex_stops: ['#00AE42', '#1BBB93'] })

		expect(screen.getByRole('button', { name: 'Підняти колір 2' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Опустити колір 1' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Видалити колір 1' })).toBeInTheDocument()
	})
})

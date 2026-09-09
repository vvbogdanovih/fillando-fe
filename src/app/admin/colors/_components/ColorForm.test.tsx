import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DragEndEvent, DroppableContainer, UniqueIdentifier } from '@dnd-kit/core'
import { ColorForm } from './ColorForm'
import type { Color } from '../colors.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// The dialog only writes on submit, and no test here submits.
vi.mock('../colors.api', () => ({ colorsApi: { create: vi.fn(), update: vi.fn() } }))

/** What a finished drag carries: `to: null` is a release over no row at all. */
let drag: { from: UniqueIdentifier; to: UniqueIdentifier | null } = { from: '', to: '' }

/** What the drop handling threw, if anything — dnd-kit itself would only report it. */
let dropError: unknown = null

/** One row as dnd-kit knows it: the id a drop will carry and the slot `SortableContext` gave it. */
interface RegisteredStop {
	id: UniqueIdentifier
	node: HTMLElement | null
	index: number | undefined
}

/**
 * The registrations of the live `DndContext`, read back through the probe below. The drag events
 * are addressed with these and never with ids retyped in the test: `handleStopDragEnd` recovers
 * the position by parsing the id, so a test that invents them would still pass once the rows
 * registered under ids that no longer match their place in the list — the off-by-one it would
 * then act on being invisible in the admin.
 */
let readSortables: () => RegisteredStop[] = () => []

/** The stop dnd-kit is currently holding, if a drag has actually started. */
let readDraggedStop: () => string | null = () => null

/**
 * dnd-kit's pointer physics cannot run in jsdom — every rect measures 0x0, so collision
 * detection never resolves an `over` — and faking those events would be a test of dnd-kit
 * rather than of this dialog. The real `DndContext` is therefore kept (the rows stay sortable
 * exactly as in the app) and the only addition is a probe that reports what the rows registered
 * and hands the context the `DragEndEvent` a finished drag would produce, so the dialog's own
 * drop handling runs for real, on the ids its own rows own.
 */
vi.mock('@dnd-kit/core', async importOriginal => {
	const actual = await importOriginal<typeof import('@dnd-kit/core')>()
	const DragProbe = ({
		onDragEnd
	}: Pick<ComponentProps<typeof actual.DndContext>, 'onDragEnd'>) => {
		const { active, droppableContainers } = actual.useDndContext()
		// Read when called, not when rendered: a row lands in the context one render after it
		// mounts, and the tests read this after the dialog has settled.
		readSortables = () =>
			droppableContainers.toArray().map((container: DroppableContainer) => ({
				id: container.id,
				node: container.node.current,
				index: container.data.current?.sortable?.index
			}))
		readDraggedStop = () => (active ? String(active.id) : null)
		return (
			<button
				type='button'
				data-testid='finish-drag'
				onClick={() => {
					dropError = null
					try {
						onDragEnd?.({
							active: { id: drag.from },
							over: drag.to === null ? null : { id: drag.to }
						} as DragEndEvent)
					} catch (error) {
						dropError = error
					}
				}}
			/>
		)
	}
	return {
		...actual,
		DndContext: ({ children, ...props }: ComponentProps<typeof actual.DndContext>) => (
			<actual.DndContext {...props}>
				{children}
				<DragProbe onDragEnd={props.onDragEnd} />
			</actual.DndContext>
		)
	}
})

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

/** The HEX inputs in document order — the stops as the admin reads them down the dialog. */
const hexes = () =>
	screen.getAllByLabelText(/^HEX \d+$/).map(input => (input as HTMLInputElement).value)

/** The grips, one per row, in the order the rows are on screen. */
const handles = () => screen.getAllByRole('button', { name: 'Перетягнути, щоб змінити порядок' })

/** The number printed at the head of each row — the one the buttons name in their labels. */
const rowNumbers = () => handles().map(handle => handle.nextElementSibling?.textContent)

/**
 * What every row registered with dnd-kit, matched to the row by its own DOM node: the id a real
 * drop would carry and the position the sortable list holds it at.
 */
const rowSortables = () => {
	const registered = readSortables()
	return handles().map(handle => {
		const sortable = registered.find(entry => entry.node === handle.parentElement)
		return { id: String(sortable?.id), index: sortable?.index }
	})
}

/** A finished drag, addressed with the ids the rows themselves handed to dnd-kit. */
const dragStop = (fromRow: number, toRow: number) => {
	const ids = rowSortables().map(sortable => sortable.id)
	drag = { from: ids[fromRow - 1], to: ids[toRow - 1] }
	fireEvent.click(screen.getByTestId('finish-drag'))
}

/** dnd-kit reports a release over no row as `over: null` — a cancelled drag. */
const dragStopNowhere = (fromRow: number) => {
	drag = { from: rowSortables()[fromRow - 1].id, to: null }
	fireEvent.click(screen.getByTestId('finish-drag'))
}

/** dnd-kit's own live region: in jsdom it is the only place a started drag becomes observable. */
const announcement = () => screen.getByRole('status').textContent ?? ''

const SIX_STOPS = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666']

/**
 * The stop list is the payload: `hex_stops[0]` is the primary colour that goes into `g:color` and
 * into every other place needing one colour, so a bug in adding, deleting or reordering rewrites
 * what Merchant is told about the product while the dialog still looks correct.
 */
describe('ColorForm — the stop list', () => {
	it('appends a stop, and the counter follows', () => {
		renderDialog({ ...GREEN, hex_stops: ['#00AE42'] })

		fireEvent.click(screen.getByRole('button', { name: 'Додати' }))

		expect(hexes()).toEqual(['#00AE42', '#000000'])
		expect(screen.getByText('Кольори (2/6)')).toBeInTheDocument()
	})

	it('deletes the row its button names and renumbers what is left', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.click(screen.getByRole('button', { name: 'Видалити колір 2' }))

		expect(hexes()).toEqual(['#111111', '#333333'])
		expect(screen.queryByLabelText('HEX 3')).not.toBeInTheDocument()
		expect(screen.getByText('Кольори (2/6)')).toBeInTheDocument()
		// The numbering is what every button and label of the row names, so it has to close the
		// gap literally: a «HEX 1» holding the second colour aims the next edit at another stop.
		expect(screen.getByLabelText('HEX 1')).toHaveValue('#111111')
		expect(screen.getByLabelText('HEX 2')).toHaveValue('#333333')
		expect(rowNumbers()).toEqual(['1', '2'])
	})

	/** The one delete that rewrites `hex_stops[0]`, and with it `g:color`. */
	it('makes the second stop primary when the first row is deleted', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.click(screen.getByRole('button', { name: 'Видалити колір 1' }))

		expect(hexes()).toEqual(['#222222', '#333333'])
	})

	/**
	 * Stops may repeat — Dual-Silk can carry the same tone twice — which is why a row is addressed
	 * by its position: deleting by value would take both rows of a repeated colour at once.
	 */
	it('deletes one of two identical stops, not both', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#111111', '#222222'] })

		fireEvent.click(screen.getByRole('button', { name: 'Видалити колір 2' }))

		expect(hexes()).toEqual(['#111111', '#222222'])
	})

	/** A colour with no stops has nothing to paint — neither here nor on the storefront. */
	it('cannot delete the last remaining stop', () => {
		renderDialog({ ...GREEN, hex_stops: ['#00AE42'] })

		expect(screen.getByRole('button', { name: 'Видалити колір 1' })).toBeDisabled()

		fireEvent.click(screen.getByRole('button', { name: 'Додати' }))

		expect(screen.getByRole('button', { name: 'Видалити колір 1' })).toBeEnabled()
	})

	it('«Підняти» swaps the stop with the one above it', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.click(screen.getByRole('button', { name: 'Підняти колір 3' }))

		// The values move, not just the row numbers: an off-by-one in `moveStop` renumbers the
		// rows and leaves the colours where they were.
		expect(hexes()).toEqual(['#111111', '#333333', '#222222'])
	})

	/**
	 * The move the whole list exists for: whatever reaches row 1 is the primary colour, so this is
	 * the click that changes what the feed says about every product carrying this colour.
	 */
	it('«Підняти» can make the second stop the primary one', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.click(screen.getByRole('button', { name: 'Підняти колір 2' }))

		expect(hexes()).toEqual(['#222222', '#111111', '#333333'])
	})

	it('«Опустити» swaps it with the one below', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.click(screen.getByRole('button', { name: 'Опустити колір 1' }))

		expect(hexes()).toEqual(['#222222', '#111111', '#333333'])
	})

	it('has nowhere to move the first stop up or the last one down', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		expect(screen.getByRole('button', { name: 'Підняти колір 1' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Опустити колір 3' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Підняти колір 2' })).toBeEnabled()
		expect(screen.getByRole('button', { name: 'Опустити колір 2' })).toBeEnabled()
	})

	/** Both inputs of a row write the same stop, and each writes only its own. */
	it('edits the stop of the row that was typed into', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.change(screen.getByLabelText('HEX 2'), { target: { value: '#abcdef' } })

		expect(hexes()).toEqual(['#111111', '#abcdef', '#333333'])
	})

	it('edits the same stop from the colour picker beside it', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

		fireEvent.change(screen.getByLabelText('Колір 3'), { target: { value: '#abcdef' } })

		expect(hexes()).toEqual(['#111111', '#222222', '#abcdef'])
	})

	/**
	 * `Button` sets no default `type` and every stop control sits inside the dialog's `<form>`, so
	 * without an explicit `type='button'` a click meant to edit the list saves and closes the
	 * dialog instead.
	 */
	it('never submits the dialog from a stop control', () => {
		renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222'] })
		const submitted = vi.fn()
		const add = screen.getByRole('button', { name: 'Додати' })
		add.closest('form')?.addEventListener('submit', submitted)

		fireEvent.click(add)
		fireEvent.click(screen.getByRole('button', { name: 'Видалити колір 1' }))
		fireEvent.click(screen.getByRole('button', { name: 'Підняти колір 2' }))
		fireEvent.click(screen.getByRole('button', { name: 'Опустити колір 1' }))
		fireEvent.click(handles()[0])

		expect(submitted).not.toHaveBeenCalled()
	})

	/** Six is where a 24px circle stops being readable, hence `MAX_STOPS`. */
	it('offers no seventh stop', () => {
		renderDialog({ ...GREEN, hex_stops: SIX_STOPS })

		expect(screen.getByRole('button', { name: 'Додати' })).toBeDisabled()
		expect(screen.getByText('Кольори (6/6)')).toBeInTheDocument()
	})

	it('still offers the sixth', () => {
		renderDialog({ ...GREEN, hex_stops: SIX_STOPS.slice(0, 5) })

		expect(screen.getByRole('button', { name: 'Додати' })).toBeEnabled()
	})

	describe('reordering by drag', () => {
		it('gives every stop a drag handle that announces itself as sortable', () => {
			renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

			expect(handles()).toHaveLength(3)
			handles().forEach(handle =>
				expect(handle).toHaveAttribute('aria-roledescription', 'sortable')
			)
		})

		/**
		 * `aria-roledescription` above comes from `useSortable`'s attributes, which outlive a grip
		 * whose drag activators were dropped — a dead button that still announces itself as
		 * sortable. This is the assertion that the grip can actually pick the row up, and it is
		 * also where the id of that row surfaces: dnd-kit names what it picked up.
		 */
		it('picks a row up by its own handle', () => {
			renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

			fireEvent.keyDown(handles()[2], { code: 'Space' })

			expect(readDraggedStop()).toBe(rowSortables()[2].id)
			expect(announcement()).toContain(rowSortables()[2].id)
		})

		/**
		 * `handleStopDragEnd` recovers the position by parsing the id, so a drop moves whatever the
		 * row registered rather than the row that was dragged. Nothing in the admin shows the ids,
		 * which is why they are pinned here: with them one row ahead, dropping the third stop on
		 * the first splices past the end of the list and puts an empty stop into the payload.
		 */
		it('registers each row under the id its position implies', () => {
			renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

			expect(rowSortables()).toEqual([
				{ id: 'stop-0', index: 0 },
				{ id: 'stop-1', index: 1 },
				{ id: 'stop-2', index: 2 }
			])
		})

		/**
		 * A drop is an insertion, not a swap: dropping the third stop on the first has to leave
		 * the other two in their order below it, which is what makes the dragged colour primary.
		 */
		it('lifts the third stop to the top and pushes the rest down', () => {
			renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

			dragStop(3, 1)

			expect(hexes()).toEqual(['#333333', '#111111', '#222222'])
		})

		/** A drag released off the list is a cancelled one: the stops must survive it intact. */
		it('keeps the order when a stop is released over no row', () => {
			renderDialog({ ...GREEN, hex_stops: ['#111111', '#222222', '#333333'] })

			dragStopNowhere(3)

			expect(dropError).toBeNull()
			expect(hexes()).toEqual(['#111111', '#222222', '#333333'])
		})
	})
})

/** The gradient's `rgb()` list — jsdom re-serialises the hex stops, order preserved. */
const previewStops = (swatch: HTMLElement) =>
	swatch.style.backgroundImage.match(/rgb\([^)]+\)/g) ?? []

describe('ColorForm — the first stop is the primary colour', () => {
	it('says so, and says what reads it', () => {
		renderDialog()

		expect(
			screen.getByText(/Перший колір — основний: його бере фід і будь-яке місце/)
		).toBeInTheDocument()
	})

	/**
	 * The promise above is only true if the preview obeys it too: the swatch beside it is painted
	 * from the stops in their current order, so reordering repaints it.
	 */
	it('paints the preview from the stops in their current order', () => {
		renderDialog({ ...GREEN, hex_stops: ['#ff0000', '#00ff00', '#0000ff'] })
		const swatch = screen.getByRole('img', { name: 'Колір' })

		expect(previewStops(swatch)).toEqual(['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)'])

		fireEvent.click(screen.getByRole('button', { name: 'Опустити колір 1' }))

		expect(previewStops(swatch)).toEqual(['rgb(0, 255, 0)', 'rgb(255, 0, 0)', 'rgb(0, 0, 255)'])
	})
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterDrawer } from './FilterDrawer'

afterEach(cleanup)

const renderDrawer = (over: Partial<Parameters<typeof FilterDrawer>[0]> = {}) => {
	const onClose = vi.fn()
	render(
		<FilterDrawer open onClose={onClose} total={42} isFetching={false} {...over}>
			<p>сайдбар</p>
		</FilterDrawer>
	)
	return onClose
}

describe('FilterDrawer — «Показати N товарів»', () => {
	it('carries the total of the current narrowing, in the right plural', () => {
		renderDrawer({ total: 42 })
		expect(screen.getByRole('button', { name: 'Показати 42 товари' })).toBeInTheDocument()

		cleanup()
		renderDrawer({ total: 1 })
		expect(screen.getByRole('button', { name: 'Показати 1 товар' })).toBeInTheDocument()
	})

	it('drops the number while a new set of filters is loading', () => {
		renderDrawer({ isFetching: true })

		const button = screen.getByRole('button', { name: 'Показати товари' })
		expect(button).toHaveAttribute('aria-busy', 'true')
	})

	it('has no number before anything has loaded', () => {
		renderDrawer({ total: undefined })
		expect(screen.getByRole('button', { name: 'Показати товари' })).toBeInTheDocument()
	})

	it('closes the drawer — filters are already applied, nothing else to do', () => {
		const onClose = renderDrawer()

		fireEvent.click(screen.getByRole('button', { name: 'Показати 42 товари' }))
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it('offers «Очистити» only when there is something to clear', () => {
		renderDrawer()
		expect(screen.queryByRole('button', { name: 'Очистити' })).not.toBeInTheDocument()

		cleanup()
		const onClearAll = vi.fn()
		renderDrawer({ onClearAll })
		fireEvent.click(screen.getByRole('button', { name: 'Очистити' }))
		expect(onClearAll).toHaveBeenCalledTimes(1)
	})

	it('renders the sidebar it is given', () => {
		renderDrawer()
		expect(screen.getByText('сайдбар')).toBeInTheDocument()
	})
})

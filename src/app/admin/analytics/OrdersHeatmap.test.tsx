import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HEAT_STEPS } from './analytics.constants'
import { OrdersHeatmap } from './OrdersHeatmap'

afterEach(cleanup)

describe('OrdersHeatmap', () => {
	it('draws every weekday × hour cell, reads each one aloud and steps the colour on the max', () => {
		render(
			<OrdersHeatmap
				cells={[
					{ weekday: 1, hour: 9, orders: 3 },
					{ weekday: 5, hour: 21, orders: 12 }
				]}
			/>
		)

		const cells = screen.getAllByRole('img')
		expect(cells).toHaveLength(168)

		const busiest = screen.getByLabelText('Пт, 21:00 — 12 замовлень')
		expect(busiest).toHaveAttribute('data-step', '5')
		expect(busiest).toHaveStyle({ background: HEAT_STEPS[5] })

		expect(screen.getByLabelText('Пн, 09:00 — 3 замовлення')).toHaveAttribute('data-step', '2')
		expect(screen.getByLabelText('Нд, 03:00 — 0 замовлень')).toHaveAttribute('data-step', '0')
	})
})

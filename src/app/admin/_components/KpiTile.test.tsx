import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { KpiTile } from './KpiTile'

afterEach(cleanup)

describe('KpiTile', () => {
	it('prints the label and the value as separate nodes', () => {
		render(<KpiTile label='товарів у фіді' value={142} tone='good' />)

		expect(screen.getByText('142')).toBeInTheDocument()
		expect(screen.getByText('товарів у фіді')).toBeInTheDocument()
	})

	it('colours a warning tone only when the number is positive (the feed contract)', () => {
		const { rerender } = render(<KpiTile label='попереджень' value={0} tone='warn' />)
		expect(screen.getByText('0')).not.toHaveClass('text-amber-700')

		rerender(<KpiTile label='попереджень' value={4} tone='warn' />)
		expect(screen.getByText('4')).toHaveClass('text-amber-700')
	})

	it('paints the delta by direction × whether up is good', () => {
		const { rerender } = render(
			<KpiTile
				label='Замовлення'
				value={120}
				delta={{ percent: 12.5, upIsGood: true, label: '+12,5 %' }}
			/>
		)
		expect(screen.getByLabelText('Зміна проти попереднього періоду')).toHaveTextContent(
			'+12,5 %'
		)
		expect(screen.getByLabelText('Зміна проти попереднього періоду')).toHaveClass(
			'text-emerald-700'
		)

		rerender(
			<KpiTile
				label='Скасовано'
				value={6}
				delta={{ percent: 50, upIsGood: false, label: '+50 %' }}
			/>
		)
		expect(screen.getByLabelText('Зміна проти попереднього періоду')).toHaveClass(
			'text-red-700'
		)
	})

	it('shows a dash when there is nothing to compare to', () => {
		render(
			<KpiTile
				label='Виручка'
				value='1 000 ₴'
				delta={{
					percent: null,
					upIsGood: true,
					label: '',
					previous: 'попередній період: 0 ₴'
				}}
			/>
		)

		expect(screen.getByLabelText('Зміна проти попереднього періоду')).toHaveTextContent('—')
		expect(screen.getByText('попередній період: 0 ₴')).toBeInTheDocument()
	})
})

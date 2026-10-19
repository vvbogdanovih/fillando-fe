import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusHistoryCard } from './StatusHistoryCard'

describe('StatusHistoryCard', () => {
	it('shows a line edit as the totals before and after, with what changed and what is owed', () => {
		render(
			<StatusHistoryCard
				history={[
					{
						field: 'items',
						from: '1000',
						to: '1200',
						at: '2026-10-19T10:00:00.000Z',
						actor: 'admin',
						note: '+PETG червоний ×1 — оплачено 1 000,00 ₴, доплата 200,00 ₴'
					}
				]}
			/>
		)

		expect(screen.getByText('Склад:')).toBeInTheDocument()
		expect(screen.getByText(/1\s?000,00\s?₴ → 1\s?200,00\s?₴/)).toBeInTheDocument()
		expect(screen.getByText(/доплата 200,00/)).toBeInTheDocument()
		expect(screen.getByText('Адмін')).toBeInTheDocument()
	})

	it('still reads a status move as labels', () => {
		render(
			<StatusHistoryCard
				history={[
					{
						field: 'order_status',
						from: 'NEW',
						to: 'CONFIRMED',
						at: '2026-10-19T10:00:00.000Z',
						actor: 'admin'
					}
				]}
			/>
		)

		expect(screen.getByText('Нове → Підтверджено')).toBeInTheDocument()
	})
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaymentMethodOptions } from './PaymentMethodOptions'

afterEach(cleanup)

describe('PaymentMethodOptions', () => {
	it('offers the three offline methods and reports the pick', () => {
		const onChange = vi.fn()
		render(
			<PaymentMethodOptions
				value={null}
				onChange={onChange}
				deliveryMethod='NOVA_POST'
				currentMethod='LIQPAY'
			/>
		)

		expect(screen.getAllByRole('radio')).toHaveLength(3)
		fireEvent.click(screen.getByLabelText(/Накладний платіж/))
		expect(onChange).toHaveBeenCalledWith('COD')
	})

	it('greys out cash for a parcel and says why', () => {
		render(
			<PaymentMethodOptions
				value={null}
				onChange={vi.fn()}
				deliveryMethod='COURIER'
				currentMethod='LIQPAY'
			/>
		)

		expect(screen.getByLabelText(/Готівка/)).toBeDisabled()
		expect(screen.getByText('Доступно лише при самовивозі')).toBeInTheDocument()
		expect(screen.getByLabelText(/Накладний платіж/)).toBeEnabled()
	})

	it('greys out cash on delivery for a pickup order', () => {
		render(
			<PaymentMethodOptions
				value={null}
				onChange={vi.fn()}
				deliveryMethod='PICKUP'
				currentMethod='LIQPAY'
			/>
		)

		expect(screen.getByLabelText(/Накладний платіж/)).toBeDisabled()
		expect(screen.getByLabelText(/Готівка/)).toBeEnabled()
	})

	it('marks the method the order already has as current and not selectable', () => {
		render(
			<PaymentMethodOptions
				value={null}
				onChange={vi.fn()}
				deliveryMethod='NOVA_POST'
				currentMethod='COD'
			/>
		)

		expect(screen.getByLabelText(/Накладний платіж/)).toBeDisabled()
		expect(screen.getByText('Поточний спосіб оплати')).toBeInTheDocument()
	})
})

'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { paymentDetailsApi } from './payment-details.api'
import { PaymentDetailsList } from './_components/PaymentDetailsList'
import { PaymentDetailsForm } from './_components/PaymentDetailsForm'
import type { PaymentDetail } from './payment-details.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; record: PaymentDetail }

export const PaymentDetails = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: records = [],
		isLoading,
		isError,
		refetch
	} = useQuery({
		queryKey: ['payment-details'],
		queryFn: () => paymentDetailsApi.getAll()
	})

	const selectedRecord =
		panel.mode === 'edit'
			? (records.find(r => r._id === panel.record._id) ?? panel.record)
			: null

	const handleEdit = (record: PaymentDetail | null) => {
		setPanel(record ? { mode: 'edit', record } : { mode: 'closed' })
	}

	const isPanelOpen = panel.mode !== 'closed'
	const formKey = panel.mode === 'edit' ? panel.record._id : 'create'

	return (
		<div className='flex h-full min-h-0'>
			<div className={`min-w-0 shrink-0 ${isPanelOpen ? 'flex-1' : 'w-full'}`}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center text-sm text-gray-400'>
						Завантаження...
					</div>
				) : isError ? (
					<div className='flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500'>
						<p>Помилка завантаження реквізитів</p>
						<button
							type='button'
							onClick={() => refetch()}
							className='text-primary text-sm hover:underline'
						>
							Спробувати знову
						</button>
					</div>
				) : (
					<PaymentDetailsList
						records={records}
						editingId={panel.mode === 'edit' ? panel.record._id : null}
						onEdit={handleEdit}
						onCreate={() => setPanel({ mode: 'create' })}
					/>
				)}
			</div>

			{isPanelOpen && (
				<div className='w-full max-w-md shrink-0 border-l border-gray-200'>
					<PaymentDetailsForm
						key={formKey}
						initial={panel.mode === 'edit' ? selectedRecord : null}
						onClose={() => setPanel({ mode: 'closed' })}
					/>
				</div>
			)}
		</div>
	)
}

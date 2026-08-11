'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { paymentProvidersApi } from './payment-providers.api'
import { PaymentProviderList } from './_components/PaymentProviderList'
import { PaymentProviderForm } from './_components/PaymentProviderForm'
import type { PaymentProvider, PaymentProviderKey } from './payment-providers.schema'

type PanelState =
	| { mode: 'closed' }
	| { mode: 'create' }
	| { mode: 'edit'; record: PaymentProvider }

interface PaymentProvidersProps {
	provider: PaymentProviderKey
}

export const PaymentProviders = ({ provider }: PaymentProvidersProps) => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: allRecords = [],
		isLoading,
		isError,
		refetch
	} = useQuery({
		queryKey: ['payment-providers'],
		queryFn: () => paymentProvidersApi.getAll()
	})

	const records = allRecords.filter(r => r.provider === provider)

	const selectedRecord =
		panel.mode === 'edit'
			? (records.find(r => r._id === panel.record._id) ?? panel.record)
			: null

	const handleEdit = (record: PaymentProvider | null) => {
		setPanel(record ? { mode: 'edit', record } : { mode: 'closed' })
	}

	const isPanelOpen = panel.mode !== 'closed'

	return (
		<div className='flex h-full min-h-0'>
			<div className={`min-w-0 shrink-0 ${isPanelOpen ? 'flex-1' : 'w-full'}`}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center text-sm text-gray-500'>
						Завантаження…
					</div>
				) : isError ? (
					<div className='flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500'>
						Не вдалося завантажити ключі.
						<button
							className='text-primary underline underline-offset-4'
							onClick={() => void refetch()}
						>
							Спробувати ще раз
						</button>
					</div>
				) : (
					<PaymentProviderList
						records={records}
						editingId={panel.mode === 'edit' ? panel.record._id : null}
						onEdit={handleEdit}
						onCreate={() => setPanel({ mode: 'create' })}
					/>
				)}
			</div>

			{isPanelOpen && (
				<div className='w-full max-w-md shrink-0 border-l border-gray-200'>
					<PaymentProviderForm
						key={panel.mode === 'edit' ? panel.record._id : 'create'}
						provider={provider}
						initial={selectedRecord}
						onClose={() => setPanel({ mode: 'closed' })}
					/>
				</div>
			)}
		</div>
	)
}

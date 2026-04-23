'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { vendorsApi } from './vendors.api'
import { VendorList } from './_components/VendorList'
import { VendorForm } from './_components/VendorForm'
import type { Vendor } from './vendors.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; vendor: Vendor }

export const Vendors = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: vendors = [],
		isLoading,
		isError,
		refetch
	} = useQuery({
		queryKey: ['vendors'],
		queryFn: () => vendorsApi.getAll()
	})

	// Keep edit panel in sync with cache updates
	const selectedVendor =
		panel.mode === 'edit'
			? (vendors.find(v => v._id === panel.vendor._id) ?? panel.vendor)
			: null

	const handleSelect = (vendor: Vendor | null) => {
		setPanel(vendor ? { mode: 'edit', vendor } : { mode: 'closed' })
	}

	const isPanelOpen = panel.mode !== 'closed'
	const formKey = panel.mode === 'edit' ? panel.vendor._id : 'create'

	return (
		<div className='flex h-full'>
			{/* Left pane: vendor list */}
			<div className={`shrink-0 ${isPanelOpen ? 'w-72' : 'w-full max-w-md'} transition-all`}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center text-sm text-gray-400'>
						Завантаження...
					</div>
				) : isError ? (
					<div className='flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500'>
						<p>Помилка завантаження вендорів</p>
						<button
							onClick={() => refetch()}
							className='text-primary text-sm hover:underline'
						>
							Спробувати знову
						</button>
					</div>
				) : (
					<VendorList
						vendors={vendors}
						selectedId={panel.mode === 'edit' ? panel.vendor._id : null}
						onSelect={handleSelect}
						onCreate={() => setPanel({ mode: 'create' })}
					/>
				)}
			</div>

			{/* Right pane: create / edit form */}
			{isPanelOpen && (
				<div className='flex-1 border-l border-gray-200'>
					<VendorForm
						key={formKey}
						initial={panel.mode === 'edit' ? selectedVendor : null}
						onClose={() => setPanel({ mode: 'closed' })}
					/>
				</div>
			)}
		</div>
	)
}

'use client'
import { useId, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * One block of the category page (owner, 2026-11-04: «нереально зрозуміти що для чого
 * потрібно»): a white card whose header is the toggle — the title, and one sentence on what the
 * block sets and where the shopper sees it — and whose form unfolds below a separator. The
 * button is named by the title alone; the sentence is its description.
 */
export function SettingsCard({
	title,
	description,
	open,
	onToggle,
	children
}: {
	title: string
	description: string
	open: boolean
	onToggle: () => void
	children: ReactNode
}) {
	const descriptionId = useId()
	return (
		<section
			aria-label={title}
			className='rounded-lg border border-gray-200 bg-white shadow-sm'
		>
			<button
				type='button'
				aria-label={title}
				aria-describedby={descriptionId}
				aria-expanded={open}
				onClick={onToggle}
				className='flex w-full items-start justify-between gap-4 rounded-lg p-4 text-left hover:bg-gray-50'
			>
				<span className='min-w-0'>
					<span className='block font-semibold text-gray-900'>{title}</span>
					<span id={descriptionId} className='mt-0.5 block text-sm text-gray-500'>
						{description}
					</span>
				</span>
				<ChevronDown
					size={18}
					aria-hidden
					className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
				/>
			</button>
			{open && <div className='space-y-3 border-t border-gray-200 p-4'>{children}</div>}
		</section>
	)
}

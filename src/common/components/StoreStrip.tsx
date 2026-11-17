import { CONTACTS } from '@/common/constants'

/**
 * The thin strip above the header on every storefront page (TD-0015): the shop's short promises
 * from «Вітрина» and its phone. No lines — no strip. A phone keeps it to one row: the first line
 * and the phone.
 */
export function StoreStrip({ items }: { items: string[] }) {
	if (!items.length) return null
	return (
		<div className='bg-[#0f172a] text-[13px] text-[#e8f1f6]'>
			<div className='container mx-auto flex max-w-7xl items-center gap-x-6 px-4 py-2'>
				{items.map((item, index) => (
					<span key={index} className={index ? 'hidden md:inline' : 'min-w-0 truncate'}>
						{item}
					</span>
				))}
				<a
					href={`tel:${CONTACTS.PHONE}`}
					className='hover:text-primary ml-auto shrink-0 tabular-nums transition-colors'
				>
					{CONTACTS.PHONE_DISPLAY}
				</a>
			</div>
		</div>
	)
}

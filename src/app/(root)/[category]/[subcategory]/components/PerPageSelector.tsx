'use client'

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'

const OPTIONS = [12, 24, 36, 48] as const

interface PerPageSelectorProps {
	value: number
	onChange: (limit: number) => void
}

export const PerPageSelector = ({ value, onChange }: PerPageSelectorProps) => {
	return (
		<div className='flex items-center gap-2'>
			<span className='text-muted-foreground text-sm'>Показати:</span>
			<Select value={String(value)} onValueChange={v => onChange(Number(v))}>
				<SelectTrigger size='sm' className='w-[70px] bg-white text-black'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{OPTIONS.map(opt => (
						<SelectItem key={opt} value={String(opt)}>
							{opt}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

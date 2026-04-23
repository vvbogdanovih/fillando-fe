'use client'

import { useEffect, useState } from 'react'
import { Slider } from '@/common/components/ui/slider'
import { Input } from '@/common/components/ui/input'

interface PriceRangeFilterProps {
	min: number
	max: number
	currentMin: number
	currentMax: number
	onChange: (min: number, max: number) => void
}

export const PriceRangeFilter = ({
	min,
	max,
	currentMin,
	currentMax,
	onChange
}: PriceRangeFilterProps) => {
	const [localMin, setLocalMin] = useState(currentMin)
	const [localMax, setLocalMax] = useState(currentMax)

	useEffect(() => {
		setLocalMin(currentMin)
		setLocalMax(currentMax)
	}, [currentMin, currentMax])

	const handleCommit = (values: number[]) => {
		onChange(values[0], values[1])
	}

	const handleMinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		setLocalMin(val)
	}

	const handleMaxInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		setLocalMax(val)
	}

	const handleInputBlur = () => {
		const safeMin = Math.max(min, Math.min(localMin, localMax))
		const safeMax = Math.min(max, Math.max(localMin, localMax))
		onChange(safeMin, safeMax)
	}

	const disabled = min === 0 && max === 0

	return (
		<div className='space-y-3'>
			<p className='text-sm font-semibold'>Ціна</p>
			<Slider
				min={min}
				max={max || 1}
				step={1}
				value={[localMin, localMax]}
				onValueChange={values => {
					setLocalMin(values[0])
					setLocalMax(values[1])
				}}
				onValueCommit={handleCommit}
				disabled={disabled}
				className={disabled ? 'opacity-50' : ''}
			/>
			<div className='flex items-center gap-2'>
				<Input
					type='number'
					value={localMin}
					onChange={handleMinInput}
					onBlur={handleInputBlur}
					disabled={disabled}
					className='h-8 text-sm'
				/>
				<span className='text-muted-foreground text-xs'>—</span>
				<Input
					type='number'
					value={localMax}
					onChange={handleMaxInput}
					onBlur={handleInputBlur}
					disabled={disabled}
					className='h-8 text-sm'
				/>
			</div>
		</div>
	)
}

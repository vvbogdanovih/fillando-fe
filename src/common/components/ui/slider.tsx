'use client'

import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'

import { cn } from '@/common/utils/shad-cn.utils'

const thumbClassName =
	'block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

function Slider({
	className,
	defaultValue,
	value,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	const values = value ?? defaultValue ?? [0]
	const thumbCount = Array.isArray(values) ? values.length : 1
	return (
		<SliderPrimitive.Root
			data-slot='slider'
			className={cn('relative flex w-full touch-none items-center select-none', className)}
			defaultValue={defaultValue}
			value={value}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot='slider-track'
				className='bg-secondary relative h-2 w-full grow overflow-hidden rounded-full'
			>
				<SliderPrimitive.Range
					data-slot='slider-range'
					className='bg-primary absolute h-full'
				/>
			</SliderPrimitive.Track>
			{Array.from({ length: thumbCount }).map((_, i) => (
				<SliderPrimitive.Thumb
					key={i}
					data-slot='slider-thumb'
					data-index={i}
					className={thumbClassName}
				/>
			))}
		</SliderPrimitive.Root>
	)
}

export { Slider }

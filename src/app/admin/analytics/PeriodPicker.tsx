'use client'

import { useEffect, useId, useState } from 'react'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import {
	isCalendarDay,
	PERIOD_PRESETS,
	periodForPreset,
	type AnalyticsPeriod,
	type PeriodPreset
} from './analytics.utils'

interface PeriodPickerProps {
	period: AnalyticsPeriod
	preset: PeriodPreset | 'custom'
	/** Today in Kyiv — the upper bound of both inputs. */
	today: string
	onChange: (period: AnalyticsPeriod) => void
}

/**
 * Presets first, a custom range after them — one row above every chart. The inputs are local
 * state so a half-typed date never fires a query; a valid pair is applied as soon as both ends
 * are set, and a reversed pair is explained rather than silently swapped.
 */
export const PeriodPicker = ({ period, preset, today, onChange }: PeriodPickerProps) => {
	const fromId = useId()
	const toId = useId()
	const [from, setFrom] = useState(period.from)
	const [to, setTo] = useState(period.to)

	// A preset click (or the back button) changes the period from outside; follow it.
	useEffect(() => {
		setFrom(period.from)
		setTo(period.to)
	}, [period.from, period.to])

	const reversed = isCalendarDay(from) && isCalendarDay(to) && from > to

	const apply = (nextFrom: string, nextTo: string) => {
		if (!isCalendarDay(nextFrom) || !isCalendarDay(nextTo) || nextFrom > nextTo) return
		if (nextFrom === period.from && nextTo === period.to) return
		onChange({ from: nextFrom, to: nextTo })
	}

	return (
		<div className='flex flex-wrap items-end gap-3'>
			<div className='flex flex-wrap gap-1' role='group' aria-label='Період'>
				{PERIOD_PRESETS.map(item => (
					<Button
						key={item.key}
						size='sm'
						variant={preset === item.key ? 'default' : 'outline'}
						aria-pressed={preset === item.key}
						onClick={() => onChange(periodForPreset(item.key, today))}
					>
						{item.label}
					</Button>
				))}
			</div>
			<div className='flex flex-wrap items-end gap-2'>
				<div className='space-y-1'>
					<Label htmlFor={fromId} className='text-xs text-gray-500'>
						Від
					</Label>
					<Input
						id={fromId}
						type='date'
						className='h-8 w-40 text-sm'
						value={from}
						max={today}
						onChange={event => {
							setFrom(event.target.value)
							apply(event.target.value, to)
						}}
					/>
				</div>
				<div className='space-y-1'>
					<Label htmlFor={toId} className='text-xs text-gray-500'>
						До
					</Label>
					<Input
						id={toId}
						type='date'
						className='h-8 w-40 text-sm'
						value={to}
						max={today}
						onChange={event => {
							setTo(event.target.value)
							apply(from, event.target.value)
						}}
					/>
				</div>
				{reversed && (
					<p className='text-xs text-red-700' role='alert'>
						Дата «від» пізніша за «до»
					</p>
				)}
			</div>
		</div>
	)
}

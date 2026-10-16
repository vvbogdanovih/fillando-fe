import { describe, expect, it } from 'vitest'
import { formatUah } from '@/common/utils/price.utils'
import type { HeatmapCell, WeekdayPoint } from './analytics.schema'
import {
	analyticsQuery,
	breakdownLabel,
	daysBetween,
	deltaPercent,
	formatDayFull,
	formatDayShort,
	formatDayTick,
	formatDayWithWeekday,
	formatSignedPercent,
	heatmapGrid,
	heatmapStep,
	isCalendarDay,
	matchPreset,
	MAX_PERIOD_DAYS,
	parseAnalyticsParams,
	periodForPreset,
	shiftDay,
	todayKyiv,
	weekdayExtremes,
	weekdaySentence,
	weekendBands,
	weekStartTicks
} from './analytics.utils'

/*
 * `vitest.config.ts` pins `TZ=America/Los_Angeles` for the whole suite: a negative offset is
 * the one that turns `new Date('2026-10-13')` into 12 October, so any helper that slips back
 * to local formatting fails here rather than on an admin's laptop abroad.
 */

const TODAY = '2026-10-16' // a Friday

describe('todayKyiv', () => {
	it('is the Kyiv day, not the UTC one', () => {
		expect(todayKyiv(new Date('2026-10-13T22:30:00.000Z'))).toBe('2026-10-14') // EEST +03
		expect(todayKyiv(new Date('2026-12-31T22:30:00.000Z'))).toBe('2027-01-01') // EET +02
		expect(todayKyiv(new Date('2026-10-13T12:00:00.000Z'))).toBe('2026-10-13')
	})
})

describe('calendar arithmetic', () => {
	it('shifts across month ends and the DST switch as whole days', () => {
		expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
		expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29')
		expect(shiftDay('2026-10-26', -1)).toBe('2026-10-25')
		expect(daysBetween('2026-10-01', '2026-10-30')).toBe(30)
		expect(daysBetween('2026-10-01', '2026-10-01')).toBe(1)
	})

	it('accepts only a real day', () => {
		expect(isCalendarDay('2026-02-28')).toBe(true)
		expect(isCalendarDay('2026-02-30')).toBe(false)
		expect(isCalendarDay('abc')).toBe(false)
		expect(isCalendarDay(null)).toBe(false)
	})
})

describe('presets', () => {
	it.each([
		['7d', { from: '2026-10-10', to: '2026-10-16' }],
		['14d', { from: '2026-10-03', to: '2026-10-16' }],
		['30d', { from: '2026-09-17', to: '2026-10-16' }],
		['90d', { from: '2026-07-19', to: '2026-10-16' }],
		['this_month', { from: '2026-10-01', to: '2026-10-16' }],
		['last_month', { from: '2026-09-01', to: '2026-09-30' }]
	] as const)('%s', (preset, expected) => {
		expect(periodForPreset(preset, TODAY)).toEqual(expected)
		expect(matchPreset(expected, TODAY)).toBe(preset)
	})

	it('handles the first of the month and the year wrap', () => {
		expect(periodForPreset('this_month', '2026-10-01')).toEqual({
			from: '2026-10-01',
			to: '2026-10-01'
		})
		expect(periodForPreset('last_month', '2026-01-05')).toEqual({
			from: '2025-12-01',
			to: '2025-12-31'
		})
	})

	it('calls anything else custom', () => {
		expect(matchPreset({ from: '2026-09-01', to: '2026-09-14' }, TODAY)).toBe('custom')
	})
})

describe('parseAnalyticsParams / analyticsQuery', () => {
	const parse = (query: string) => parseAnalyticsParams(new URLSearchParams(query), TODAY)
	const DEFAULT = { from: '2026-09-17', to: '2026-10-16' }

	it('defaults when the pair is missing, partial or not a date', () => {
		expect(parse('')).toEqual(DEFAULT)
		expect(parse('from=2026-09-01')).toEqual(DEFAULT)
		expect(parse('from=abc&to=2026-09-30')).toEqual(DEFAULT)
		expect(parse('from=2026-02-30&to=2026-03-10')).toEqual(DEFAULT)
	})

	it('swaps a reversed pair, clamps the future and trims an over-long range', () => {
		expect(parse('from=2026-09-30&to=2026-09-01')).toEqual({
			from: '2026-09-01',
			to: '2026-09-30'
		})
		expect(parse('from=2026-10-01&to=2026-12-31')).toEqual({
			from: '2026-10-01',
			to: '2026-10-16'
		})
		expect(parse('from=2026-12-01&to=2026-12-31')).toEqual({
			from: '2026-10-16',
			to: '2026-10-16'
		})
		const trimmed = parse('from=2024-01-01&to=2026-10-16')
		expect(daysBetween(trimmed.from, trimmed.to)).toBe(MAX_PERIOD_DAYS)
	})

	it('keeps the default period off the address and round-trips the rest', () => {
		expect(analyticsQuery(DEFAULT, TODAY)).toBe('')
		const custom = { from: '2026-09-01', to: '2026-09-30' }
		expect(analyticsQuery(custom, TODAY)).toBe('?from=2026-09-01&to=2026-09-30')
		expect(parse(analyticsQuery(custom, TODAY).slice(1))).toEqual(custom)
	})
})

describe('day formatting under a negative-offset zone', () => {
	it('never slides a day into its neighbour', () => {
		expect(formatDayShort('2026-10-13')).toBe('13 жовт.')
		expect(formatDayFull('2026-10-13')).toBe('13.10.2026')
		expect(formatDayShort('2026-03-01')).toBe('1 бер.')
	})
})

describe('deltas and shares', () => {
	it('answers a percent change, or null with nothing to compare to', () => {
		expect(deltaPercent(120, 100)).toBe(20)
		expect(deltaPercent(80, 100)).toBe(-20)
		expect(deltaPercent(5, 0)).toBeNull()
		expect(deltaPercent(0, 0)).toBeNull()
	})

	it('prints a signed percent with a real minus', () => {
		expect(formatSignedPercent(12.5)).toBe('+12,5 %')
		expect(formatSignedPercent(-3.1)).toBe('−3,1 %')
		expect(formatSignedPercent(0)).toBe('0 %')
		expect(formatSignedPercent(4, 'п.п.')).toBe('+4 п.п.')
	})
})

describe('weekday profile', () => {
	const row = (weekday: number, avg_orders: number, avg_revenue: number): WeekdayPoint => ({
		weekday,
		days_in_range: 4,
		orders: avg_orders * 4,
		revenue: avg_revenue * 4,
		avg_orders,
		avg_revenue
	})

	it('names the strongest and weakest day, revenue breaking a tie', () => {
		const rows = [row(1, 4.3, 9120), row(2, 1.1, 2300), row(3, 4.3, 8000), row(7, 1.1, 1900)]

		const extremes = weekdayExtremes(rows)

		expect(extremes?.best.weekday).toBe(1)
		expect(extremes?.worst.weekday).toBe(7)
		expect(weekdaySentence(extremes!)).toBe(
			`Найсильніший день — понеділок: у середньому 4,3 замовлення і ${formatUah(9120)} на день. ` +
				`Найслабший — неділя: 1,1 замовлення і ${formatUah(1900)}.`
		)
	})

	it('has no opinion about an empty period', () => {
		expect(weekdayExtremes([row(1, 0, 0), row(2, 0, 0)])).toBeNull()
		expect(weekdayExtremes([])).toBeNull()
	})
})

describe('heatmap', () => {
	it('fills a 7 × 24 grid and steps the colour on the max', () => {
		const cells: HeatmapCell[] = [
			{ weekday: 1, hour: 9, orders: 3 },
			{ weekday: 7, hour: 23, orders: 10 }
		]
		const grid = heatmapGrid(cells)

		expect(grid).toHaveLength(7)
		expect(grid.every(row => row.length === 24)).toBe(true)
		expect(grid[0][9]).toBe(3)
		expect(grid[6][23]).toBe(10)
		expect(grid[3][12]).toBe(0)
		expect(heatmapStep(0, 10)).toBe(0)
		expect(heatmapStep(1, 10)).toBe(1)
		expect(heatmapStep(10, 10)).toBe(5)
		expect(heatmapStep(5, 0)).toBe(0)
	})
})

describe('breakdownLabel', () => {
	it('maps a known key and shows an unknown one as is', () => {
		expect(breakdownLabel('payment_method', 'LIQPAY')).toBe('LiqPay')
		expect(breakdownLabel('order_status', 'CANCELLED')).toBe('Скасовано')
		expect(breakdownLabel('payment_method', 'APPLE_PAY')).toBe('APPLE_PAY')
	})
})

describe('week boundaries on the daily axis', () => {
	// 2026-10-05 is a Monday; a 14-day range from it holds two Mondays and two weekends.
	const days = Array.from({ length: 14 }, (_, index) => ({ day: shiftDay('2026-10-05', index) }))

	it('puts ticks on the Mondays when there are at least two, otherwise on every day', () => {
		expect(weekStartTicks(days)).toEqual(['2026-10-05', '2026-10-12'])
		expect(weekStartTicks(days.slice(0, 7))).toEqual(days.slice(0, 7).map(point => point.day))
	})

	it('names the weekend bands and a half weekend at the edge', () => {
		expect(weekendBands(days)).toEqual([
			['2026-10-10', '2026-10-11'],
			['2026-10-17', '2026-10-18']
		])
		// A range that opens on a Sunday: the Sunday stands alone.
		expect(weekendBands([{ day: '2026-10-11' }, { day: '2026-10-12' }])).toEqual([
			['2026-10-11', '2026-10-11']
		])
	})

	it('reads a day with its weekday', () => {
		expect(formatDayWithWeekday('2026-10-05')).toBe('понеділок, 05.10.2026')
		expect(formatDayTick('2026-10-05')).toBe('Пн 5 жовт.')
		expect(formatDayTick('2026-10-06')).toBe('6 жовт.')
	})
})

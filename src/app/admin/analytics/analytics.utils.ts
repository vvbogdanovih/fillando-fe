import { formatUah, SHOP_TIME_ZONE } from '@/common/utils/price.utils'
import { pluralUk } from '@/common/utils/plural.utils'
import {
	DELIVERY_METHOD_LABELS,
	ORDER_STATUS_LABELS,
	PAYMENT_METHOD_LABELS,
	PAYMENT_STATUS_LABELS
} from '../orders/orders.constants'
import type { BreakdownRow, HeatmapCell, OrderStatsTotals, WeekdayPoint } from './analytics.schema'

/*
 * Three clocks can disagree on this page: the browser's zone, Kyiv and UTC. The rules are
 * (1) «today» is the Kyiv day, read through `Intl` and nothing else; (2) a `YYYY-MM-DD` from
 * the API is calendar arithmetic in `Date.UTC`, never `new Date(day)` — that is UTC midnight,
 * which any browser west of London formats as the day before; (3) formatting a day pins
 * `timeZone: 'UTC'` for the same reason. `analytics.utils.test.ts` runs under a negative-offset
 * zone to keep it so.
 */

export type PeriodPreset = '7d' | '14d' | '30d' | '90d' | 'this_month' | 'last_month'

export const PERIOD_PRESETS: ReadonlyArray<{ key: PeriodPreset; label: string }> = [
	{ key: '7d', label: '7 днів' },
	{ key: '14d', label: '14 днів' },
	{ key: '30d', label: '30 днів' },
	{ key: '90d', label: '90 днів' },
	{ key: 'this_month', label: 'Цей місяць' },
	{ key: 'last_month', label: 'Минулий місяць' }
]

export const DEFAULT_PRESET: PeriodPreset = '30d'
/** Mirrors the backend's `MAX_STATS_DAYS`. */
export const MAX_PERIOD_DAYS = 366

export interface AnalyticsPeriod {
	from: string
	to: string
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

const dayToUtc = (day: string): number => {
	const [year, month, date] = day.split('-').map(Number)
	return Date.UTC(year, month - 1, date)
}

const utcToDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

const kyivDay = new Intl.DateTimeFormat('en-CA', {
	timeZone: SHOP_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
})

/** Today's calendar day in the shop's zone — the only «today» on the page. */
export const todayKyiv = (now: Date = new Date()): string => kyivDay.format(now)

/** A `YYYY-MM-DD` that names a real day; `2026-02-30` fails the round trip. */
export const isCalendarDay = (value: string | null | undefined): value is string =>
	typeof value === 'string' && DAY_PATTERN.test(value) && utcToDay(dayToUtc(value)) === value

export const shiftDay = (day: string, days: number): string =>
	utcToDay(dayToUtc(day) + days * MS_PER_DAY)

/** Inclusive: `daysBetween('2026-10-01', '2026-10-01')` is 1. */
export const daysBetween = (from: string, to: string): number =>
	Math.round((dayToUtc(to) - dayToUtc(from)) / MS_PER_DAY) + 1

export const periodForPreset = (preset: PeriodPreset, today: string): AnalyticsPeriod => {
	switch (preset) {
		case '7d':
			return { from: shiftDay(today, -6), to: today }
		case '14d':
			return { from: shiftDay(today, -13), to: today }
		case '30d':
			return { from: shiftDay(today, -29), to: today }
		case '90d':
			return { from: shiftDay(today, -89), to: today }
		case 'this_month':
			return { from: `${today.slice(0, 8)}01`, to: today }
		case 'last_month': {
			const [year, month] = today.split('-').map(Number)
			// Day 0 of this month is the last day of the previous one; the year wrap is free.
			const lastDay = utcToDay(Date.UTC(year, month - 1, 0))
			return { from: `${lastDay.slice(0, 8)}01`, to: lastDay }
		}
	}
}

const samePeriod = (a: AnalyticsPeriod, b: AnalyticsPeriod) => a.from === b.from && a.to === b.to

export const matchPreset = (period: AnalyticsPeriod, today: string): PeriodPreset | 'custom' =>
	PERIOD_PRESETS.find(preset => samePeriod(periodForPreset(preset.key, today), period))?.key ??
	'custom'

/**
 * The period lives in the URL (`?from=2026-09-01&to=2026-09-30`), like the order list's filters.
 * Anything unparseable falls back to the default rather than to an error; a reversed pair is
 * swapped, a future end is clamped to today and an over-long range is trimmed from the start.
 */
export const parseAnalyticsParams = (params: URLSearchParams, today: string): AnalyticsPeriod => {
	const from = params.get('from')
	const to = params.get('to')
	if (!isCalendarDay(from) || !isCalendarDay(to)) return periodForPreset(DEFAULT_PRESET, today)

	let [start, end] = from <= to ? [from, to] : [to, from]
	if (end > today) end = today
	if (start > end) start = end
	if (daysBetween(start, end) > MAX_PERIOD_DAYS) start = shiftDay(end, -(MAX_PERIOD_DAYS - 1))

	return { from: start, to: end }
}

/** The query string for a period; the default period keeps the plain address. */
export const analyticsQuery = (period: AnalyticsPeriod, today: string): string => {
	if (samePeriod(period, periodForPreset(DEFAULT_PRESET, today))) return ''
	const query = new URLSearchParams({ from: period.from, to: period.to })
	return `?${query.toString()}`
}

// --- formatting -----------------------------------------------------------------------------

const dayShort = new Intl.DateTimeFormat('uk-UA', {
	day: 'numeric',
	month: 'short',
	timeZone: 'UTC'
})

/** «13 жовт.» — for axis ticks. */
export const formatDayShort = (day: string): string => dayShort.format(new Date(dayToUtc(day)))

/** «13.10.2026» — for tooltips, tables and the period line. */
export const formatDayFull = (day: string): string => {
	const [year, month, date] = day.split('-')
	return `${date}.${month}.${year}`
}

/** ISO weekday of a `YYYY-MM-DD`: 1 Monday … 7 Sunday. */
export const isoWeekday = (day: string): number => {
	const utcDay = new Date(dayToUtc(day)).getUTCDay()
	return utcDay === 0 ? 7 : utcDay
}

/** «понеділок, 13.10.2026» — the tooltip header, so a bar is read with its weekday. */
export const formatDayWithWeekday = (day: string): string =>
	`${weekdayLong(isoWeekday(day))}, ${formatDayFull(day)}`

/** «Пн 13 жовт.» for a Monday tick, «13 жовт.» otherwise. */
export const formatDayTick = (day: string): string =>
	isoWeekday(day) === 1 ? `Пн ${formatDayShort(day)}` : formatDayShort(day)

/**
 * Where the weeks start: every Monday in the range. With fewer than two Mondays (a 7-day
 * period) the axis falls back to every day, otherwise the ticks sit on the Mondays alone.
 */
export const mondays = (days: ReadonlyArray<{ day: string }>): string[] =>
	days.filter(point => isoWeekday(point.day) === 1).map(point => point.day)

export const weekStartTicks = (days: ReadonlyArray<{ day: string }>): string[] => {
	const starts = mondays(days)
	return starts.length >= 2 ? starts : days.map(point => point.day)
}

/** Saturday–Sunday pairs inside the range, as `[first, last]` day keys, for the weekend shading. */
export const weekendBands = (days: ReadonlyArray<{ day: string }>): [string, string][] => {
	const bands: [string, string][] = []
	for (const point of days) {
		const weekday = isoWeekday(point.day)
		if (weekday === 6) bands.push([point.day, point.day])
		else if (weekday === 7) {
			const last = bands[bands.length - 1]
			if (last && last[1] === shiftDay(point.day, -1)) last[1] = point.day
			else bands.push([point.day, point.day])
		}
	}
	return bands
}

export const formatPeriod = (period: AnalyticsPeriod): string =>
	`${formatDayFull(period.from)} – ${formatDayFull(period.to)}`

/** ISO weekday 1..7 → index 0..6. Fixed lists rather than `Intl`, for capitalisation. */
export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] as const
export const WEEKDAY_LONG = [
	'понеділок',
	'вівторок',
	'середа',
	'четвер',
	'пʼятниця',
	'субота',
	'неділя'
] as const

export const weekdayShort = (weekday: number): string => WEEKDAY_SHORT[weekday - 1] ?? '—'
export const weekdayLong = (weekday: number): string => WEEKDAY_LONG[weekday - 1] ?? '—'

export const formatHour = (hour: number): string => `${String(hour).padStart(2, '0')}:00`

const decimal = (digits: number) =>
	new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: digits })

export const formatNumber = (value: number, digits = 1): string => decimal(digits).format(value)

/** «12,5 %» */
export const formatPercent = (value: number, digits = 1): string =>
	`${decimal(digits).format(value)} %`

/** «+12,5 %» / «−3,1 %» (U+2212, like `promoPercentLabel`) / «0 %». */
export const formatSignedPercent = (value: number, unit = '%'): string => {
	const magnitude = decimal(1).format(Math.abs(value))
	if (value > 0) return `+${magnitude} ${unit}`
	if (value < 0) return `−${magnitude} ${unit}`
	return `0 ${unit}`
}

export const ordersWord = (count: number): string =>
	Number.isInteger(count)
		? pluralUk(count, 'замовлення', 'замовлення', 'замовлень')
		: // A fraction («4,3 замовлення») reads with the «few» form.
			'замовлення'

// --- derivations ----------------------------------------------------------------------------

/** Percent change; `null` when there is nothing to compare to. */
export const deltaPercent = (current: number, previous: number): number | null =>
	previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10

export const share = (part: number, total: number): number =>
	total === 0 ? 0 : (part / total) * 100

export const paidShare = (totals: OrderStatsTotals): number => share(totals.paid, totals.orders)

export interface WeekdayExtremes {
	best: WeekdayPoint
	worst: WeekdayPoint
}

/**
 * The strongest and weakest weekday by average orders per day, revenue breaking a tie. `null`
 * when every weekday is zero — there is no «best» day in an empty period.
 */
export const weekdayExtremes = (rows: WeekdayPoint[]): WeekdayExtremes | null => {
	if (rows.length === 0 || rows.every(row => row.avg_orders === 0)) return null
	const byStrength = [...rows].sort(
		(a, b) => b.avg_orders - a.avg_orders || b.avg_revenue - a.avg_revenue
	)
	return { best: byStrength[0], worst: byStrength[byStrength.length - 1] }
}

const weekdayFigure = (row: WeekdayPoint): string =>
	`${formatNumber(row.avg_orders)} ${ordersWord(row.avg_orders)} і ${formatUah(Math.round(row.avg_revenue))}`

/** The one sentence the ad budget is set from. */
export const weekdaySentence = ({ best, worst }: WeekdayExtremes): string =>
	`Найсильніший день — ${weekdayLong(best.weekday)}: у середньому ${weekdayFigure(best)} на день. ` +
	`Найслабший — ${weekdayLong(worst.weekday)}: ${weekdayFigure(worst)}.`

/** A 7 × 24 grid (`[weekday − 1][hour]`); cells the backend left out read as zero. */
export const heatmapGrid = (cells: HeatmapCell[]): number[][] => {
	const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
	for (const cell of cells) {
		if (cell.weekday >= 1 && cell.weekday <= 7 && cell.hour >= 0 && cell.hour <= 23) {
			grid[cell.weekday - 1][cell.hour] += cell.orders
		}
	}
	return grid
}

export const heatmapMax = (grid: number[][]): number =>
	grid.reduce((max, row) => Math.max(max, ...row), 0)

/** 0 is «nothing»; 1–5 climb one hue. */
export const heatmapStep = (value: number, max: number): 0 | 1 | 2 | 3 | 4 | 5 => {
	if (value <= 0 || max <= 0) return 0
	return Math.min(5, Math.max(1, Math.ceil((value / max) * 5))) as 1 | 2 | 3 | 4 | 5
}

export type BreakdownDimension =
	| 'payment_method'
	| 'delivery_method'
	| 'order_status'
	| 'payment_status'

const BREAKDOWN_LABELS: Record<BreakdownDimension, Record<string, string>> = {
	payment_method: PAYMENT_METHOD_LABELS,
	delivery_method: DELIVERY_METHOD_LABELS,
	order_status: ORDER_STATUS_LABELS,
	payment_status: PAYMENT_STATUS_LABELS
}

/** An unknown key is shown as itself — a new backend value must not hide a row. */
export const breakdownLabel = (dimension: BreakdownDimension, key: string): string =>
	BREAKDOWN_LABELS[dimension][key] ?? key

export const sortBreakdown = (rows: BreakdownRow[]): BreakdownRow[] =>
	[...rows].sort((a, b) => b.orders - a.orders)

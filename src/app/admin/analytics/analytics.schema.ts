import '@/common/lib/zod-locale'
import * as z from 'zod'

/**
 * The response of `GET /orders/stats` (fillando-be `OrderStatsResponseDto`). Breakdown keys are
 * plain strings rather than enums on purpose: a payment method added on the backend must not
 * take the whole dashboard down — it shows under its raw key until a label is added.
 */
const periodSchema = z.object({
	date_from: z.string(),
	date_to: z.string(),
	days: z.number()
})

const totalsSchema = z.object({
	orders: z.number(),
	cancelled: z.number(),
	paid: z.number(),
	revenue: z.number(),
	avg_order_value: z.number(),
	units: z.number()
})

const dayPointSchema = z.object({
	day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	weekday: z.number().int().min(1).max(7),
	orders: z.number(),
	cancelled: z.number(),
	paid: z.number(),
	revenue: z.number(),
	units: z.number()
})

const weekdayPointSchema = z.object({
	weekday: z.number().int().min(1).max(7),
	days_in_range: z.number(),
	orders: z.number(),
	revenue: z.number(),
	avg_orders: z.number(),
	avg_revenue: z.number()
})

const hourPointSchema = z.object({
	hour: z.number().int().min(0).max(23),
	orders: z.number(),
	revenue: z.number()
})

const heatmapCellSchema = z.object({
	weekday: z.number().int().min(1).max(7),
	hour: z.number().int().min(0).max(23),
	orders: z.number()
})

const breakdownRowSchema = z.object({
	key: z.string(),
	orders: z.number(),
	revenue: z.number()
})

const topProductSchema = z.object({
	variant_id: z.string().nullable(),
	product_id: z.string().nullable(),
	sku: z.string(),
	name: z.string(),
	quantity: z.number(),
	orders: z.number(),
	revenue: z.number(),
	avg_price: z.number()
})

export const orderStatsSchema = z.object({
	period: periodSchema,
	previous_period: periodSchema,
	generated_at: z.string(),
	totals: totalsSchema,
	previous_period_totals: totalsSchema,
	by_day: z.array(dayPointSchema),
	by_weekday: z.array(weekdayPointSchema),
	by_hour: z.array(hourPointSchema),
	heatmap: z.array(heatmapCellSchema),
	by_payment_method: z.array(breakdownRowSchema),
	by_delivery_method: z.array(breakdownRowSchema),
	by_order_status: z.array(breakdownRowSchema),
	by_payment_status: z.array(breakdownRowSchema),
	top_products_by_revenue: z.array(topProductSchema),
	top_products_by_quantity: z.array(topProductSchema)
})

export type OrderStats = z.infer<typeof orderStatsSchema>
export type OrderStatsTotals = z.infer<typeof totalsSchema>
export type DayPoint = z.infer<typeof dayPointSchema>
export type WeekdayPoint = z.infer<typeof weekdayPointSchema>
export type HeatmapCell = z.infer<typeof heatmapCellSchema>
export type BreakdownRow = z.infer<typeof breakdownRowSchema>
export type TopProduct = z.infer<typeof topProductSchema>

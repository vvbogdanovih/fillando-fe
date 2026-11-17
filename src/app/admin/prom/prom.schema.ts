import '@/common/lib/zod-locale'
import * as z from 'zod'

const promSyncProgressSchema = z.object({
	type: z.literal('progress'),
	total: z.number(),
	processed: z.number(),
	updated: z.number(),
	pricesUpdated: z.number(),
	skipped: z.number(),
	/** Held back while a catalogue operation ran (TD-0013); absent from an older backend. */
	deferred: z.number().default(0),
	errors: z.number()
})

const promSyncDoneSchema = z.object({
	type: z.literal('done'),
	total: z.number(),
	processed: z.number(),
	updated: z.number(),
	pricesUpdated: z.number(),
	skipped: z.number(),
	/** Held back while a catalogue operation ran (TD-0013); absent from an older backend. */
	deferred: z.number().default(0),
	errors: z.number()
})

const promSyncErrorSchema = z.object({
	type: z.literal('error'),
	message: z.string()
})

export const promSyncEventSchema = z.discriminatedUnion('type', [
	promSyncProgressSchema,
	promSyncDoneSchema,
	promSyncErrorSchema
])

export type PromSyncEvent = z.infer<typeof promSyncEventSchema>

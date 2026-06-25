import { z } from 'zod'

const promSyncProgressSchema = z.object({
	type: z.literal('progress'),
	total: z.number(),
	processed: z.number(),
	updated: z.number(),
	skipped: z.number(),
	errors: z.number()
})

const promSyncDoneSchema = z.object({
	type: z.literal('done'),
	total: z.number(),
	processed: z.number(),
	updated: z.number(),
	skipped: z.number(),
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

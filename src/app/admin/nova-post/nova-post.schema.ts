import { z } from 'zod'

const syncProgressProgressSchema = z.object({
	type: z.literal('progress'),
	entity: z.enum(['cities', 'warehouses']),
	synced: z.number()
})

const syncProgressDoneSchema = z.object({
	type: z.literal('done'),
	cities: z.number(),
	warehouses: z.number()
})

const syncProgressErrorSchema = z.object({
	type: z.literal('error'),
	message: z.string()
})

export const syncProgressEventSchema = z.discriminatedUnion('type', [
	syncProgressProgressSchema,
	syncProgressDoneSchema,
	syncProgressErrorSchema
])

export type SyncProgressEvent = z.infer<typeof syncProgressEventSchema>

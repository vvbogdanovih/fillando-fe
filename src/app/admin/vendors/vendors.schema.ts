import { z } from 'zod'

// --- Response schemas ---

export const vendorSchema = z.object({
	_id: z.string(),
	name: z.string(),
	slug: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
})

export const vendorsListSchema = z.array(vendorSchema)

// --- Form schema ---

export const vendorFormSchema = z.object({
	name: z.string().min(1, "Назва є обов'язковою"),
	slug: z
		.string()
		.min(1, "Slug є обов'язковим")
		.regex(/^[a-z0-9-]+$/, 'Тільки малі літери, цифри та дефіс')
})

// --- Types ---

export type Vendor = z.infer<typeof vendorSchema>
export type VendorFormValues = z.infer<typeof vendorFormSchema>

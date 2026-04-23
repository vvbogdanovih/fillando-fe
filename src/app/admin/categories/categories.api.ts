import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	categorySchema,
	categoriesListSchema,
	subcategorySchema,
	type CategoryFormValues,
	type SubcategoryFormValues
} from './categories.schema'

// --- Category CRUD ---

export const categoriesApi = {
	getWithSubcategories: () =>
		httpService.get(API_URLS.CATEGORIES.WITH_SUBCATEGORIES, {
			schema: categoriesListSchema
		}),

	create: (data: CategoryFormValues) =>
		httpService.post(API_URLS.CATEGORIES.BASE, data, {
			schema: categorySchema,
			skipErrorToast: true
		}),

	update: (id: string, data: Partial<CategoryFormValues> & { image?: string | null }) =>
		httpService.patch(API_URLS.CATEGORIES.BY_ID(id), data, {
			schema: categorySchema,
			skipErrorToast: true
		}),

	delete: (id: string) =>
		httpService.delete<{ message: string }, undefined>(API_URLS.CATEGORIES.BY_ID(id)),

	// --- Subcategory CRUD ---

	createSubcategory: (catId: string, data: SubcategoryFormValues) =>
		httpService.post(API_URLS.CATEGORIES.SUBCATEGORIES(catId), data, {
			schema: categorySchema,
			skipErrorToast: true
		}),

	updateSubcategory: (catId: string, subId: string, data: SubcategoryFormValues) =>
		httpService.patch(API_URLS.CATEGORIES.SUBCATEGORY_BY_ID(catId, subId), data, {
			schema: categorySchema,
			skipErrorToast: true
		}),

	deleteSubcategory: (catId: string, subId: string) =>
		httpService.delete<{ message: string }, undefined>(
			API_URLS.CATEGORIES.SUBCATEGORY_BY_ID(catId, subId)
		),

	// --- Image upload (S3 presign flow) ---

	presignUpload: (payload: {
		files: Array<{ entityType: string; entityId: string; contentType: string }>
	}) =>
		httpService.post<
			{ files: Array<{ uploadUrl: string; publicUrl: string; key: string }> },
			typeof payload
		>(API_URLS.UPLOAD.PRESIGN, payload),

	confirmUpload: (keys: string[]) =>
		httpService.post<{ confirmed: string[]; failed: string[] }, { keys: string[] }>(
			API_URLS.UPLOAD.CONFIRM,
			{ keys }
		),

	/**
	 * Full image upload flow: presign → PUT to S3 → confirm.
	 * Returns the public URL to PATCH onto the category.
	 * On 403 from S3 PUT, re-requests presign once and retries.
	 */
	uploadImage: async (categoryId: string, file: File, retrying = false): Promise<string> => {
		const contentType = file.type as 'image/webp' | 'image/jpeg' | 'image/png'

		const presignResponse = await categoriesApi.presignUpload({
			files: [{ entityType: 'category', entityId: categoryId, contentType }]
		})

		const { uploadUrl, publicUrl, key } = presignResponse.files[0]

		const s3Response = await fetch(uploadUrl, {
			method: 'PUT',
			body: file,
			headers: { 'Content-Type': contentType }
		})

		if (s3Response.status === 403 && !retrying) {
			return categoriesApi.uploadImage(categoryId, file, true)
		}

		if (!s3Response.ok) {
			throw new Error(`S3 upload failed with status ${s3Response.status}`)
		}

		await categoriesApi.confirmUpload([key])

		return publicUrl
	}
}

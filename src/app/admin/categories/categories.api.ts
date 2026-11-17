import { httpService } from '@/common/services/http.service'
import { API_URLS, CATEGORY_TREE_PAGE_MAX } from '@/common/constants'
import {
	categoryOptionsPageSchema,
	categorySchema,
	type CategoryOption,
	type CategoryPayload
} from './categories.schema'

// --- Category CRUD ---

export const categoriesApi = {
	/**
	 * Every visible product category for a select, page by page (Plan-0010 D06): the old full
	 * list with definitions was 17.7 MB at 10 000 categories. One revision for the whole walk —
	 * a catalogue change in between is a 409 from the server or a different revision here.
	 */
	async getOptions(): Promise<CategoryOption[]> {
		const items: CategoryOption[] = []
		const cursors = new Set<string>()
		let revision: number | undefined
		let cursor: string | null = null
		do {
			const page: { revision: number; items: CategoryOption[]; next_cursor: string | null } =
				await httpService.get(API_URLS.CATEGORIES.OPTIONS, {
					params: { limit: CATEGORY_TREE_PAGE_MAX, ...(cursor ? { cursor } : {}) },
					schema: categoryOptionsPageSchema
				})
			if (revision !== undefined && revision !== page.revision)
				throw Error('Список категорій змінився. Оновіть сторінку.')
			revision = page.revision
			items.push(...page.items)
			cursor = page.next_cursor
			if (cursor && cursors.has(cursor)) throw Error('Не вдалося завантажити категорії.')
			if (cursor) cursors.add(cursor)
		} while (cursor)
		return items
	},

	/** One category with its characteristics — what a form needs of the selected category. */
	getById: (id: string) =>
		httpService.get(API_URLS.CATEGORIES.BY_ID(id), {
			schema: categorySchema
		}),

	create: (data: CategoryPayload) =>
		httpService.post(API_URLS.CATEGORIES.BASE, data, {
			schema: categorySchema,
			skipErrorToast: true
		}),

	update: (id: string, data: Partial<CategoryPayload> & { image?: string | null }) =>
		httpService.patch(API_URLS.CATEGORIES.BY_ID(id), data, {
			schema: categorySchema,
			skipErrorToast: true
		}),

	delete: (id: string) =>
		httpService.delete<{ message: string }, undefined>(API_URLS.CATEGORIES.BY_ID(id)),

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

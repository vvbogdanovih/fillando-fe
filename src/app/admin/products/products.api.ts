import axios from 'axios'
import { httpService } from '@/common/services/http.service'
import { API_BASE_URL, API_URLS } from '@/common/constants'
import {
	productResponseSchema,
	productDetailSchema,
	productListItemSchema,
	productVariantsListResponseSchema,
	validateResponseSchema,
	type Product,
	type ProductDetail,
	type ProductListItem,
	type ProductVariantFull,
	type PriceListPayload
} from './products.schema'
import { parseAttachmentFilename } from './products.utils'
import '@/common/lib/zod-locale'
import * as z from 'zod'

const PRICE_LIST_FALLBACK_ERROR = 'Не вдалося сформувати прайс-лист'

/**
 * A failed blob request still carries a JSON error body. Bare axios skips the
 * httpService interceptor, so there is no auto-toast — the caller surfaces this.
 */
const readErrorBlob = async (blob: Blob): Promise<string> => {
	try {
		const parsed = JSON.parse(await blob.text()) as { message?: string | string[] }
		const message = Array.isArray(parsed.message) ? parsed.message[0] : parsed.message
		return message ?? PRICE_LIST_FALLBACK_ERROR
	} catch {
		return PRICE_LIST_FALLBACK_ERROR
	}
}

// --- Payload types ---

interface CreateProductPayload {
	name: string
	vendor_id: string
	category_id: string
	description: { json: object; html: string } | null
	attributes: Array<{ k: string; l: string; v: string | number | boolean }>
	variant_type: { key: string; label: string } | null
	variants: Array<{
		v_value: string | null
		price: number
		stock: number
		images: string[]
		vendor_product_sku?: string
		prom_id?: string
	}>
}

interface UpdateProductPayload {
	variants: Array<{
		v_value: string | null
		sku: string
		price: number
		stock: number
		images: string[]
	}>
}

interface UpdateProductMetadataPayload {
	name?: string
	vendor_id?: string
	category_id?: string
	description?: { json: Record<string, unknown>; html: string } | null
	variant_type?: { key: string; label: string } | null
	attributes?: Array<{ l: string; v: string | number | boolean }>
}

interface AddVariantPayload {
	price: number
	v_value?: string | null
	stock?: number
	images?: string[]
	vendor_product_sku?: string
	prom_id?: string
	status?: 'draft' | 'active' | 'archived'
}

interface UpdateVariantPayload {
	name?: string
	sku?: string
	price?: number
	stock?: number
	images?: string[]
	v_value?: string | null
	vendor_product_sku?: string
	prom_id?: string
	status?: 'draft' | 'active' | 'archived'
}

interface ValidatePayload {
	slugs: string[]
	skus: string[]
}

interface PresignFile {
	entityType: string
	entityId: string
	contentType: string
}

interface PresignResponse {
	files: Array<{ uploadUrl: string; publicUrl: string; key: string }>
}

// ---

export const productsApi = {
	getAll: (): Promise<ProductListItem[]> =>
		httpService.get(API_URLS.PRODUCTS.BASE, {
			schema: z.array(productListItemSchema)
		}),

	getById: (id: string): Promise<ProductDetail> =>
		httpService.get(API_URLS.PRODUCTS.BY_ID(id), {
			schema: productDetailSchema
		}),

	getVariants: (productId: string): Promise<ProductVariantFull[]> =>
		httpService.get(API_URLS.PRODUCTS.VARIANTS(productId), {
			schema: productVariantsListResponseSchema
		}),

	create: (data: CreateProductPayload) =>
		httpService.post(API_URLS.PRODUCTS.BASE, data, {
			schema: productResponseSchema,
			skipErrorToast: true
		}),

	update: (id: string, data: UpdateProductPayload) =>
		httpService.patch(API_URLS.PRODUCTS.BY_ID(id), data, {
			schema: productResponseSchema,
			skipErrorToast: true
		}),

	updateMetadata: (id: string, data: UpdateProductMetadataPayload): Promise<ProductDetail> =>
		httpService.patch(API_URLS.PRODUCTS.BY_ID(id), data, {
			schema: productDetailSchema,
			skipErrorToast: true
		}),

	deleteProduct: (id: string): Promise<void> => httpService.delete(API_URLS.PRODUCTS.BY_ID(id)),

	addVariant: (productId: string, data: AddVariantPayload): Promise<ProductVariantFull> =>
		httpService.post(API_URLS.PRODUCTS.VARIANTS(productId), data, {
			schema: productVariantsListResponseSchema.element,
			skipErrorToast: true
		}),

	updateVariant: (
		productId: string,
		variantId: string,
		data: UpdateVariantPayload
	): Promise<ProductVariantFull> =>
		httpService.patch(API_URLS.PRODUCTS.VARIANT_BY_ID(productId, variantId), data, {
			schema: productVariantsListResponseSchema.element,
			skipErrorToast: true
		}),

	deleteVariant: (productId: string, variantId: string): Promise<void> =>
		httpService.delete(API_URLS.PRODUCTS.VARIANT_BY_ID(productId, variantId)),

	validate: (data: ValidatePayload) =>
		httpService.post(API_URLS.PRODUCTS.VALIDATE, data, {
			schema: validateResponseSchema,
			skipErrorToast: true
		}),

	presignUpload: (payload: { files: PresignFile[] }) =>
		httpService.post<PresignResponse, typeof payload>(API_URLS.UPLOAD.PRESIGN, payload),

	confirmUpload: (keys: string[]) =>
		httpService.post<{ confirmed: string[]; failed: string[] }, { keys: string[] }>(
			API_URLS.UPLOAD.CONFIRM,
			{ keys }
		),

	setVariantImages: (productId: string, variantId: string, images: string[]) =>
		httpService.patch(API_URLS.PRODUCTS.VARIANT_IMAGES(productId, variantId), { images }),

	/**
	 * Upload image files for one variant and return the public URLs.
	 */
	uploadImages: async (productId: string, files: File[]): Promise<string[]> => {
		if (files.length === 0) return []

		const presignResponse = await productsApi.presignUpload({
			files: files.map(f => ({
				entityType: 'product',
				entityId: productId,
				contentType: f.type as 'image/jpeg' | 'image/png' | 'image/webp'
			}))
		})

		const keys: string[] = []
		const publicUrls: string[] = []

		await Promise.all(
			presignResponse.files.map(async ({ uploadUrl, publicUrl, key }, i) => {
				const s3Res = await fetch(uploadUrl, {
					method: 'PUT',
					body: files[i],
					headers: { 'Content-Type': files[i].type }
				})
				if (!s3Res.ok) {
					throw new Error(`Помилка завантаження зображення: S3 статус ${s3Res.status}`)
				}
				keys[i] = key
				publicUrls[i] = publicUrl
			})
		)

		await productsApi.confirmUpload(keys)

		return publicUrls
	},

	/**
	 * Full create flow:
	 *   1. POST /products  → product + variants (with _id per variant)
	 *   2. For each variant that has files: upload → PATCH variant images
	 */
	createWithImages: async (
		payload: CreateProductPayload,
		variantFiles: File[][]
	): Promise<Product> => {
		const product = await productsApi.create(payload)

		const hasAnyImages = variantFiles.some(files => files.length > 0)
		if (!hasAnyImages) return product

		await Promise.all(
			product.variants.map(async (variant, i) => {
				const files = variantFiles[i]
				if (!files?.length) return

				const urls = await productsApi.uploadImages(product._id, files)
				await productsApi.setVariantImages(product._id, variant._id, urls)
			})
		)

		return product
	},

	/**
	 * Bare axios on purpose: httpService pipes every response through Zod
	 * (handleAxiosResponse), which would destroy a blob body.
	 */
	downloadPriceList: async (payload: PriceListPayload): Promise<void> => {
		const response = await axios.post(
			`${API_BASE_URL}${API_URLS.PRODUCTS.PRICE_LIST_PDF}`,
			payload,
			{ responseType: 'blob', withCredentials: true }
		)

		// Not `new Blob([response.data])` — that drops the MIME type, and keeping
		// 'application/pdf' is what makes this guard (and the browser preview) work.
		const blob = response.data as Blob
		if (blob.type && !blob.type.includes('pdf')) {
			throw new Error(await readErrorBlob(blob))
		}

		const filename = parseAttachmentFilename(
			response.headers['content-disposition'] as string | undefined,
			'price-list.pdf'
		)

		const url = window.URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = filename
		document.body.appendChild(link)
		link.click()
		link.remove()
		window.URL.revokeObjectURL(url)
	}
}

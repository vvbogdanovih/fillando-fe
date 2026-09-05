import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'

/** Mirrors `UploadEntityType` in the backend's presign DTO. */
export type UploadEntityType = 'product' | 'user' | 'vendor' | 'category' | 'landing'

/** The three the backend's `UploadContentType` accepts; anything else is rejected on presign. */
export type UploadContentType = 'image/webp' | 'image/jpeg' | 'image/png'

interface PresignedFile {
	uploadUrl: string
	publicUrl: string
	key: string
}

const presign = (files: Array<{ entityType: string; entityId: string; contentType: string }>) =>
	httpService.post<{ files: PresignedFile[] }, { files: typeof files }>(API_URLS.UPLOAD.PRESIGN, {
		files
	})

const confirm = (keys: string[]) =>
	httpService.post<{ confirmed: string[]; failed: string[] }, { keys: string[] }>(
		API_URLS.UPLOAD.CONFIRM,
		{ keys }
	)

/**
 * One image through the S3 flow — presign, PUT, confirm — and back with the public URL to store
 * on the entity.
 *
 * A 403 from the PUT means the presigned URL expired between issuing and uploading (a slow
 * pick, a sleeping laptop). Re-presigning once is cheaper than making the admin retry, and the
 * retry flag stops it looping when the 403 is really a permissions problem.
 *
 * `products.api.ts` and `categories.api.ts` each still carry their own copy of this flow, from
 * before there was a third caller; they are unchanged here and worth folding in separately.
 */
export const uploadEntityImage = async (
	entityType: UploadEntityType,
	entityId: string,
	file: File,
	retrying = false
): Promise<string> => {
	const contentType = file.type as UploadContentType

	const { files } = await presign([{ entityType, entityId, contentType }])
	const { uploadUrl, publicUrl, key } = files[0]

	const response = await fetch(uploadUrl, {
		method: 'PUT',
		body: file,
		headers: { 'Content-Type': contentType }
	})

	if (response.status === 403 && !retrying) {
		return uploadEntityImage(entityType, entityId, file, true)
	}
	if (!response.ok) {
		throw new Error(`S3 upload failed with status ${response.status}`)
	}

	await confirm([key])
	return publicUrl
}

import '@/common/lib/zod-locale'
import * as z from 'zod'
import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	adminColorsListSchema,
	adminColorSchema,
	colorSchema,
	type Color,
	type ColorFormValues
} from './colors.schema'

const capabilitiesSchema = z.object({ legacy_writes_enabled: z.boolean() })
const entriesSchema = z.object({
	revision: z.number().int().nonnegative(),
	colors: z.array(adminColorSchema)
})
const receiptSchema = z.object({ color_id: z.string() })

/**
 * After the catalogue migration the legacy `/colors` writes are closed (503), so the dictionary
 * is written through the journal-backed endpoints instead — same form, same table. Which pair is
 * live is the backend's answer, read on every write: a stale guess would send a write the server
 * refuses.
 */
async function journalled() {
	const capabilities = await httpService.get(API_URLS.CATEGORIES.ADMIN_CAPABILITIES, {
		schema: capabilitiesSchema,
		skipErrorToast: true
	})
	return !capabilities.legacy_writes_enabled
}
const entries = () =>
	httpService.get(API_URLS.COLORS.ADMIN_ENTRIES, { schema: entriesSchema, skipErrorToast: true })
/** The new API's refusals are coded; the screen shows a sentence, as the legacy one did. */
function explain(error: unknown): never {
	const details = (error as { details?: { details?: { code?: string; count?: number } } })
		?.details?.details
	const messages: Record<string, string> = {
		COLOR_IN_USE: `Колір використовують ${details?.count ?? 'кілька'} варіант(ів) — спершу перепризначте їм інший колір`,
		COLOR_IDENTITY_CONFLICT: 'Колір з такою англійською назвою або адресою вже є.',
		COLOR_UNCHANGED: 'Змін немає.',
		COLOR_PLAN_TOO_LARGE:
			'Колір має забагато варіантів для однієї зміни. Зверніться до розробника.',
		CATEGORY_REVISION_CONFLICT: 'Каталог щойно змінився. Спробуйте ще раз.',
		CATALOG_WRITE_IN_PROGRESS: 'Каталог зараз оновлюється. Спробуйте за хвилину.',
		CATALOG_DRAFT_WRITES_DISABLED: 'Редагування каталогу зараз вимкнене.'
	}
	throw details?.code && messages[details.code] ? Error(messages[details.code]) : error
}
async function write(
	send: (revision: number, key: string) => Promise<unknown>
): Promise<string | undefined> {
	try {
		const { revision } = await entries()
		const receipt = receiptSchema.safeParse(await send(revision, crypto.randomUUID()))
		return receipt.success ? receipt.data.color_id : undefined
	} catch (error) {
		explain(error)
	}
}
async function savedRow(id: string | undefined): Promise<Color> {
	const row = (await entries()).colors.find(color => color._id === id)
	if (!row) throw Error('Колір збережено, але не вдалося його перечитати. Оновіть сторінку.')
	return colorSchema.parse(row)
}

export const colorsApi = {
	/**
	 * Admin listing — the same dictionary as the public `GET /colors`, plus `variant_count` per
	 * colour. Both callers of this are admin screens (the dictionary and the variant colour
	 * picker), so neither needs the public endpoint.
	 */
	getAll: () => httpService.get(API_URLS.COLORS.ADMIN, { schema: adminColorsListSchema }),

	create: async (data: ColorFormValues) => {
		if (!(await journalled()))
			return httpService.post(API_URLS.COLORS.BASE, data, {
				schema: colorSchema,
				skipErrorToast: true
			})
		const { slug, ...rest } = data
		return savedRow(
			await write((expected_revision, key) =>
				httpService.post(
					API_URLS.COLORS.ADMIN_ENTRIES,
					{ expected_revision, color: { ...rest, ...(slug?.trim() ? { slug } : {}) } },
					{ headers: { 'Idempotency-Key': key }, skipErrorToast: true }
				)
			)
		)
	},

	update: async (id: string, data: Partial<ColorFormValues>) => {
		if (!(await journalled()))
			return httpService.patch(API_URLS.COLORS.BY_ID(id), data, {
				schema: colorSchema,
				skipErrorToast: true
			})
		// The journalled update takes the whole entry: merge the edit into the stored row.
		const current = (await entries()).colors.find(color => color._id === id)
		if (!current) throw Error('Колір не знайдено. Оновіть сторінку.')
		const color = {
			name_en: data.name_en ?? current.name_en,
			name_uk: data.name_uk ?? current.name_uk,
			slug: data.slug?.trim() || current.slug,
			family: data.family ?? current.family,
			hex_stops: data.hex_stops ?? current.hex_stops,
			order: data.order ?? current.order
		}
		await write((expected_revision, key) =>
			httpService.patch(
				API_URLS.COLORS.ADMIN_ENTRY(id),
				{ expected_revision, color },
				{ headers: { 'Idempotency-Key': key }, skipErrorToast: true }
			)
		)
		return savedRow(id)
	},

	// The API answers 409 while variants still reference the colour, so the caller shows the
	// message rather than a generic toast.
	delete: async (id: string) => {
		if (!(await journalled()))
			return httpService.delete<{ success: boolean }, undefined>(API_URLS.COLORS.BY_ID(id), {
				skipErrorToast: true
			})
		await write((expected_revision, key) =>
			httpService.post(
				API_URLS.COLORS.ADMIN_DELETION(id),
				{ expected_revision },
				{ headers: { 'Idempotency-Key': key }, skipErrorToast: true }
			)
		)
		return { success: true }
	}
}

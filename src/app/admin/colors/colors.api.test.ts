import { beforeEach, expect, it, vi } from 'vitest'
import { colorsApi } from './colors.api'

const { get, post, patch, del } = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	patch: vi.fn(),
	del: vi.fn()
}))
vi.mock('@/common/services/http.service', () => ({
	httpService: { get, post, patch, delete: del }
}))
const black = {
	_id: '000000000000000000000001',
	name_en: 'Black',
	name_uk: 'Чорний',
	slug: 'black',
	family: 'black' as const,
	hex_stops: ['#000000'],
	order: 0,
	variant_count: 36
}
const answer = (legacy: boolean) =>
	get.mockImplementation(async (url: string) =>
		url === '/categories/admin/capabilities'
			? { legacy_writes_enabled: legacy }
			: { revision: 61, colors: [black] }
	)
beforeEach(() => vi.resetAllMocks())

it('keeps the legacy endpoints while the old admin still writes', async () => {
	answer(true)
	post.mockResolvedValue(black)
	const { _id, variant_count, ...form } = black
	void _id
	void variant_count
	await colorsApi.create({ ...form, slug: '' })
	expect(post).toHaveBeenCalledWith('/colors', expect.anything(), expect.anything())
	del.mockResolvedValue({ success: true })
	await colorsApi.delete(black._id)
	expect(del).toHaveBeenCalledWith(`/colors/${black._id}`, expect.anything())
})

it('writes through the journal after the migration, with the revision and a fresh key', async () => {
	answer(false)
	patch.mockResolvedValue({ operation_id: 'x', revision: 62, color_id: black._id })
	const saved = await colorsApi.update(black._id, { name_uk: 'Графітовий' })
	expect(patch).toHaveBeenCalledWith(
		`/colors/${black._id}/admin`,
		{
			expected_revision: 61,
			// The whole entry: the edit merged into the stored row.
			color: {
				name_en: 'Black',
				name_uk: 'Графітовий',
				slug: 'black',
				family: 'black',
				hex_stops: ['#000000'],
				order: 0
			}
		},
		expect.objectContaining({ headers: { 'Idempotency-Key': expect.any(String) } })
	)
	expect(saved).toMatchObject({ _id: black._id, name_en: 'Black' })
	post.mockRejectedValueOnce({
		status: 409,
		details: { details: { code: 'COLOR_IN_USE', count: 36 } }
	})
	await expect(colorsApi.delete(black._id)).rejects.toThrow(
		'Колір використовують 36 варіант(ів) — спершу перепризначте їм інший колір'
	)
	expect(post).toHaveBeenCalledWith(
		`/colors/${black._id}/admin/deletion`,
		{ expected_revision: 61 },
		expect.anything()
	)
})

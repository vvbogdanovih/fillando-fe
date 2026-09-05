import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingForm } from './LandingForm'
import type { Landing } from '../landings.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

const update = vi.fn()
const create = vi.fn()
const uploadImage = vi.fn()
vi.mock('../landings.api', () => ({
	landingsApi: {
		update: (id: string, data: unknown) => update(id, data),
		create: (data: unknown) => create(data),
		uploadImage: (id: string, file: File) => uploadImage(id, file)
	}
}))

const revalidateStorefront = vi.fn()
vi.mock('@/common/services/revalidate.service', () => ({
	revalidateStorefront: (...args: unknown[]) => revalidateStorefront(...args)
}))

vi.mock('@/app/admin/categories/categories.api', () => ({
	categoriesApi: {
		getAll: () =>
			Promise.resolve([
				{
					_id: 'cat1',
					name: 'Філамент',
					slug: 'filament',
					image: null,
					order: 0,
					required_attributes: [
						{
							key: 'polymer',
							label: 'Тип пластику',
							filter_type: 'multi-select',
							unit: null
						}
					],
					createdAt: '',
					updatedAt: ''
				}
			])
	}
}))

// The publish guard asks the catalogue how many products the pinned filters match.
vi.mock('@/app/(root)/[category]/catalog.api', () => ({
	getCatalogProducts: () => Promise.resolve({ items: [], pagination: { total: 38 } })
}))

const LANDING: Landing = {
	_id: 'l1',
	category_id: 'cat1',
	slug: 'pla-silk',
	h1: 'PLA Silk',
	title: 'PLA Silk — купити',
	meta_description: 'опис',
	intro_html: '<p>вступ</p>',
	bottom_html: '<p>текст</p>',
	faq: [{ q: 'а?', a: 'б' }],
	filters: { polymer: ['PLA'] },
	price_min: null,
	price_max: null,
	image: null,
	order: 0,
	status: 'active'
}

const renderForm = (initial: Landing | null = LANDING) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<LandingForm initial={initial} onClose={vi.fn()} />
		</QueryClientProvider>
	)
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

beforeEach(() => {
	update.mockReset()
	create.mockReset()
	uploadImage.mockReset()
	revalidateStorefront.mockReset()
})

describe('LandingForm', () => {
	/**
	 * The reason this feature exists: the storefront caches landing responses for an hour, so
	 * without the purge the copy just saved is invisible until the window lapses, and proofreading
	 * fourteen landings one at a time is not possible.
	 */
	it('purges the storefront after a landing is saved', async () => {
		update.mockResolvedValueOnce(LANDING)
		renderForm()

		save()

		await waitFor(() => expect(revalidateStorefront).toHaveBeenCalledWith('landings'))
		expect(update).toHaveBeenCalledTimes(1)
	})

	it('does not purge when the save failed — nothing changed on the storefront', async () => {
		update.mockRejectedValueOnce(new Error('409'))
		renderForm()

		save()

		await waitFor(() => expect(update).toHaveBeenCalled())
		expect(revalidateStorefront).not.toHaveBeenCalled()
	})
})

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import { NovaPostAddressFields } from './NovaPostAddressFields'

vi.mock('@/common/services/http.service', () => ({ httpService: { get: vi.fn() } }))

const get = vi.mocked(httpService.get)

const CITIES = [
	{ ref: 'lviv', description: 'Львів' },
	{ ref: 'lvivske', description: 'Львівське' }
]
const WAREHOUSES = [
	{ number: 5, description: 'Відділення №5: вул. Зелена, 1' },
	{ number: 7, description: 'Відділення №7: вул. Наукова, 2' }
]

let latest: Record<string, unknown> = {}

const Harness = ({ initial }: { initial: Record<string, unknown> }) => {
	const [address, setAddress] = useState(initial)
	latest = address
	return (
		<NovaPostAddressFields
			address={address}
			onPatch={patch => setAddress(prev => ({ ...prev, ...patch }))}
		/>
	)
}

const renderFields = (initial: Record<string, unknown>) =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<Harness initial={initial} />
		</QueryClientProvider>
	)

const stored = {
	city_name: 'Львів',
	warehouse_description: 'Відділення №5: вул. Зелена, 1',
	warehouse_number: 5
}

describe('NovaPostAddressFields — suggestions in the admin order form', () => {
	beforeEach(() => {
		get.mockReset()
		get.mockImplementation((async (url: string) =>
			url === API_URLS.NOVA_POST.CITIES ? CITIES : WAREHOUSES) as never)
	})
	afterEach(cleanup)

	it('lists the branches of the stored city and fills description and number on a pick', async () => {
		renderFields(stored)

		fireEvent.focus(screen.getByLabelText('Відділення'))
		fireEvent.click(await screen.findByText('Відділення №7: вул. Наукова, 2'))

		expect(latest).toEqual({
			city_name: 'Львів',
			warehouse_description: 'Відділення №7: вул. Наукова, 2',
			warehouse_number: 7
		})
		// The stored branch is not used as a search: the whole city is listed.
		expect(get).toHaveBeenCalledWith(
			API_URLS.NOVA_POST.WAREHOUSES,
			expect.objectContaining({ params: { cityRef: 'lviv' } })
		)
	})

	it('suggests cities while typing and clears the branch of the previous city on a pick', async () => {
		renderFields(stored)

		fireEvent.change(screen.getByLabelText('Місто'), { target: { value: 'Льві' } })
		fireEvent.click(await screen.findByText('Львівське'))

		expect(latest).toEqual({
			city_name: 'Львівське',
			warehouse_description: '',
			warehouse_number: ''
		})
	})

	it('asks for a city from the list while the typed one is not recognised', async () => {
		get.mockImplementation((async () => []) as never)
		renderFields({ ...stored, city_name: 'Невідоме' })

		fireEvent.focus(screen.getByLabelText('Відділення'))

		expect(
			await screen.findByText('Оберіть місто зі списку, щоб побачити відділення')
		).toBeTruthy()
		expect(get).not.toHaveBeenCalledWith(API_URLS.NOVA_POST.WAREHOUSES, expect.anything())
	})
})

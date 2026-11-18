'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import '@/common/lib/zod-locale'
import * as z from 'zod'
import { novaCitySchema, novaWarehouseSchema } from '@/app/(root)/checkout/checkout.api'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'

const DEBOUNCE_MS = 300
const MIN_CITY_QUERY = 2

const useDebounced = (value: string) => {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS)
		return () => clearTimeout(timer)
	}, [value])
	return debounced
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A text field with the checkout's suggestion list under it; typing stays free text. */
function SuggestField({
	label,
	value,
	placeholder,
	onType,
	open,
	onOpenChange,
	children
}: {
	label: string
	value: string
	placeholder?: string
	onType: (value: string) => void
	open: boolean
	onOpenChange: (open: boolean) => void
	children: ReactNode
}) {
	const id = useId()
	return (
		<div
			className='relative space-y-2'
			onBlur={e => {
				if (!e.currentTarget.contains(e.relatedTarget)) onOpenChange(false)
			}}
		>
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				autoComplete='off'
				spellCheck={false}
				placeholder={placeholder}
				value={value}
				onChange={e => {
					onType(e.target.value)
					onOpenChange(true)
				}}
				onFocus={() => onOpenChange(true)}
				onKeyDown={e => {
					if (e.key === 'Escape') onOpenChange(false)
				}}
			/>
			{open && children && (
				<div className='bg-popover text-popover-foreground border-border absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md'>
					{children}
				</div>
			)}
		</div>
	)
}

const Note = ({ children }: { children: ReactNode }) => (
	<p className='text-muted-foreground p-3 text-sm'>{children}</p>
)

function Options<T>({
	items,
	keyOf,
	labelOf,
	onPick
}: {
	items: T[]
	keyOf: (item: T) => string
	labelOf: (item: T) => string
	onPick: (item: T) => void
}) {
	return (
		<ul className='py-1'>
			{items.map(item => (
				<li key={keyOf(item)}>
					<button
						type='button'
						className='hover:bg-accent block w-full px-3 py-2 text-left text-sm'
						// Keeps the focus in the field, so the list is not closed before the click lands.
						onMouseDown={e => e.preventDefault()}
						onClick={() => onPick(item)}
					>
						{labelOf(item)}
					</button>
				</li>
			))}
		</ul>
	)
}

/**
 * The admin's Nova Post address with the checkout's suggestions (owner, 2026-11-18). The stored
 * address has no city ref, so the city is recognised by its exact name among the suggestions for
 * it; the warehouse list opens once it is. A pick fills the description and the number together;
 * all three fields can still be typed by hand.
 */
export function NovaPostAddressFields({
	address,
	onPatch
}: {
	address: Record<string, unknown>
	onPatch: (patch: Record<string, unknown>) => void
}) {
	const cityName = String(address.city_name ?? '')
	const warehouseText = String(address.warehouse_description ?? '')
	const [cityOpen, setCityOpen] = useState(false)
	const [warehouseOpen, setWarehouseOpen] = useState(false)
	// Until the admin types, the field shows the stored branch — searching by it would list it alone.
	const [warehouseTyped, setWarehouseTyped] = useState(false)

	const cityQuery = useDebounced(cityName.trim())
	const warehouseQuery = useDebounced(warehouseTyped ? warehouseText.trim() : '')

	const { data: cities = [], isFetching: citiesLoading } = useQuery({
		queryKey: ['admin-order', 'nova-cities', cityQuery],
		queryFn: () =>
			httpService.get(API_URLS.NOVA_POST.CITIES, {
				params: { q: cityQuery },
				schema: z.array(novaCitySchema),
				skipErrorToast: true
			}),
		enabled: cityQuery.length >= MIN_CITY_QUERY,
		staleTime: 5 * 60_000
	})
	const cityRef = cities.find(city => sameName(city.description, cityName))?.ref

	const { data: warehouses = [], isFetching: warehousesLoading } = useQuery({
		queryKey: ['admin-order', 'nova-warehouses', cityRef, warehouseQuery],
		queryFn: () =>
			httpService.get(API_URLS.NOVA_POST.WAREHOUSES, {
				params: { cityRef, ...(warehouseQuery ? { q: warehouseQuery } : {}) },
				schema: z.array(novaWarehouseSchema),
				skipErrorToast: true
			}),
		enabled: Boolean(cityRef) && warehouseOpen,
		staleTime: 5 * 60_000
	})

	return (
		<div className='grid gap-3 sm:grid-cols-3'>
			<SuggestField
				label='Місто'
				value={cityName}
				onType={value => onPatch({ city_name: value })}
				open={cityOpen}
				onOpenChange={setCityOpen}
			>
				{cityQuery.length < MIN_CITY_QUERY ? null : citiesLoading ? (
					<Note>Пошук…</Note>
				) : cities.length === 0 ? (
					<Note>Нічого не знайдено</Note>
				) : (
					<Options
						items={cities}
						keyOf={city => city.ref}
						labelOf={city => city.description}
						onPick={city => {
							// Another city's branch must not stay under the new city.
							onPatch(
								sameName(city.description, cityName)
									? { city_name: city.description }
									: {
											city_name: city.description,
											warehouse_description: '',
											warehouse_number: ''
										}
							)
							setCityOpen(false)
						}}
					/>
				)}
			</SuggestField>
			<SuggestField
				label='Відділення'
				value={warehouseText}
				placeholder='Номер, вулиця або оберіть зі списку…'
				onType={value => {
					setWarehouseTyped(true)
					onPatch({ warehouse_description: value })
				}}
				open={warehouseOpen}
				onOpenChange={setWarehouseOpen}
			>
				{!cityRef ? (
					<Note>Оберіть місто зі списку, щоб побачити відділення</Note>
				) : warehousesLoading ? (
					<Note>Завантаження…</Note>
				) : warehouses.length === 0 ? (
					<Note>Відділень не знайдено</Note>
				) : (
					<Options
						items={warehouses}
						keyOf={warehouse => `${warehouse.number}-${warehouse.description}`}
						labelOf={warehouse => warehouse.description}
						onPick={warehouse => {
							onPatch({
								warehouse_description: warehouse.description,
								warehouse_number: warehouse.number
							})
							setWarehouseTyped(false)
							setWarehouseOpen(false)
						}}
					/>
				)}
			</SuggestField>
			<div className='space-y-2'>
				<Label htmlFor='admin-order-warehouse-number'>Номер відділення</Label>
				<Input
					id='admin-order-warehouse-number'
					inputMode='numeric'
					value={String(address.warehouse_number ?? '')}
					onChange={e => onPatch({ warehouse_number: e.target.value })}
				/>
			</div>
		</div>
	)
}

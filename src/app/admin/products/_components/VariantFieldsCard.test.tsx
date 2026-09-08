import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VariantFieldsCard } from './VariantFieldsCard'
import type { ProductFormValues } from '../products.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// The card renders the colour picker, which reads the dictionary; nothing else here needs an API.
vi.mock('@/app/admin/colors/colors.api', () => ({
	colorsApi: { getAll: () => Promise.resolve([]) }
}))

const Harness = () => {
	const { control, register, formState } = useForm<ProductFormValues>({
		defaultValues: {
			name: 'Sunlu PLA Silk',
			has_variants: true,
			variants: [{ v_value: 'Золотий', price: '549', stock: '18', weight_g: '' }]
		} as ProductFormValues
	})
	return (
		<VariantFieldsCard
			index={0}
			control={control}
			register={register}
			errors={formState.errors}
			hasVariants
			productName='Sunlu PLA Silk'
			imageUploads={[]}
			onImagesChange={vi.fn()}
			canRemove={false}
		/>
	)
}

const renderCard = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>
	)
}

describe('VariantFieldsCard — the weight field', () => {
	it('explains that an empty weight blocks nothing', () => {
		renderCard()

		expect(screen.getByText(/Порожня вага не блокує нічого/)).toBeInTheDocument()
		expect(screen.getByText('shipping_weight')).toBeInTheDocument()
		// The page's own wording, not the artboard's «тариф за замовчуванням».
		expect(screen.getByText(/«за тарифом перевізника»/)).toBeInTheDocument()
		expect(screen.getByText(/міграція за назвою/)).toBeInTheDocument()
	})

	it('keeps the label the owner chose', () => {
		renderCard()

		expect(screen.getByLabelText('Вага для пошти, г')).toBeInTheDocument()
	})
})

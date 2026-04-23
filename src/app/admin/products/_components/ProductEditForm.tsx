'use client'

import { useRef, useState, useEffect } from 'react'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import type {
	Control,
	FieldErrors,
	UseFormRegister,
	UseFormSetValue,
	UseFieldArrayReturn
} from 'react-hook-form'
import { Button } from '@/common/components/ui/button'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { toSlug } from '@/common/utils'
import { NameBlock } from './NameBlock'
import { CategoryBlock } from './CategoryBlock'
import { DescriptionBlock, type DescriptionValue } from './DescriptionBlock'
import { AttributesBlock } from './AttributesBlock'
import { productsApi } from '../products.api'
import {
	productEditFormSchema,
	type ProductEditFormValues,
	type ProductFormValues,
	type ProductDetail
} from '../products.schema'
import { categoriesApi } from '../../categories/categories.api'

interface ProductEditFormProps {
	product: ProductDetail
}

export const ProductEditForm = ({ product }: ProductEditFormProps) => {
	const descriptionRef = useRef<DescriptionValue | null>(null)
	const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(product.subcategory_id)

	const {
		control,
		register,
		handleSubmit,
		setValue,
		formState: { errors, isSubmitting }
	} = useForm<ProductEditFormValues>({
		resolver: zodResolver(productEditFormSchema),
		defaultValues: {
			name: product.name,
			vendor_id: product.vendor_id,
			category_id: product.category_id,
			subcategory_id: product.subcategory_id,
			attributes: product.attributes,
			variant_type_key: product.variant_type?.key ?? null
		}
	})

	const attributesFieldArray = useFieldArray({ control, name: 'attributes' })
	const watchedCategoryId = useWatch({ control, name: 'category_id' })
	const watchedAttributes = useWatch({ control, name: 'attributes' })

	// Fetch categories to resolve required attributes for the selected subcategory
	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getWithSubcategories()
	})

	const selectedSubcategory = categories
		.flatMap(c => c.subcategories)
		.find(s => s._id === selectedSubcategoryId)

	const requiredAttrs = selectedSubcategory?.required_attributes ?? []

	// Re-seed required attributes when subcategory changes (skip initial mount).
	// Comparing with the previous value is Strict Mode-safe, unlike a "skip first run" ref.
	const prevSubcategoryId = useRef(selectedSubcategoryId)
	useEffect(() => {
		if (prevSubcategoryId.current === selectedSubcategoryId) return
		prevSubcategoryId.current = selectedSubcategoryId
		if (!selectedSubcategoryId) return
		const requiredKeys = new Set(requiredAttrs.map(attr => toSlug(attr.label)))
		const currentCustomAttrs = attributesFieldArray.fields
			.filter(f => !requiredKeys.has(f.k))
			.map(({ k, l, v }) => ({ k, l, v }))
		attributesFieldArray.replace([
			...requiredAttrs.map(attr => ({ k: toSlug(attr.label), l: attr.label, v: '' })),
			...currentCustomAttrs
		])
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSubcategoryId])

	const onSubmit = handleSubmit(async values => {
		const description =
			descriptionRef.current?.html?.replace(/<p><br><\/p>/, '') !== ''
				? descriptionRef.current
				: null

		let variantType: { key: string; label: string } | null = null
		if (values.variant_type_key) {
			const attr = values.attributes.find(a => a.k === values.variant_type_key)
			if (attr) variantType = { key: attr.k, label: attr.l }
		}

		try {
			await productsApi.updateMetadata(product._id, {
				name: values.name,
				vendor_id: values.vendor_id,
				category_id: values.category_id,
				subcategory_id: values.subcategory_id,
				description: description
					? { json: description.json as Record<string, unknown>, html: description.html }
					: null,
				variant_type: variantType,
				attributes: values.attributes.map(a => ({ l: a.l, v: a.v }))
			})
			toast.success('Продукт оновлено')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Помилка збереження'
			toast.error(message)
		}
	})

	// Type casts: ProductEditFormValues has the same relevant field names as ProductFormValues.
	// The overlapping fields (name, vendor_id, category_id, subcategory_id, attributes,
	// variant_type_key) are structurally identical, so this is safe at runtime.
	const controlCast = control as unknown as Control<ProductFormValues>
	const registerCast = register as unknown as UseFormRegister<ProductFormValues>
	const errorsCast = errors as unknown as FieldErrors<ProductFormValues>
	const setValueCast = setValue as unknown as UseFormSetValue<ProductFormValues>
	const fieldArrayCast = attributesFieldArray as unknown as UseFieldArrayReturn<
		ProductFormValues,
		'attributes'
	>

	return (
		<form onSubmit={onSubmit} className='flex flex-col gap-6'>
			<NameBlock control={controlCast} errors={errorsCast} register={registerCast} />

			<CategoryBlock
				control={controlCast}
				errors={errorsCast}
				setValue={setValueCast}
				watchCategoryId={watchedCategoryId}
				onSubcategoryChange={id => setSelectedSubcategoryId(id)}
			/>

			<DescriptionBlock
				descriptionRef={descriptionRef}
				initialValue={product.description ?? undefined}
			/>

			<AttributesBlock
				fieldArray={fieldArrayCast}
				errors={errorsCast}
				requiredAttrs={requiredAttrs}
			/>

			{/* Variant type selector */}
			<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
				<h2 className='text-sm font-semibold text-gray-900'>Тип варіанта</h2>
				<div className='flex flex-col gap-1.5'>
					<Label>Ознака варіативності</Label>
					<Controller
						control={control}
						name='variant_type_key'
						render={({ field }) => (
							<Select
								value={field.value ?? ''}
								onValueChange={val => field.onChange(val || null)}
								disabled={watchedAttributes.length === 0}
							>
								<SelectTrigger className='w-72'>
									<SelectValue
										placeholder={
											watchedAttributes.length === 0
												? 'Спочатку додайте атрибути'
												: 'Без варіантів'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{watchedAttributes.map(attr => (
										<SelectItem key={attr.k} value={attr.k}>
											{attr.l}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
					<p className='text-muted-foreground text-xs'>
						Оберіть атрибут, що визначає варіанти (наприклад: Колір). Залиште порожнім
						для продуктів без варіантів.
					</p>
				</div>
			</section>

			<div className='flex gap-3 pb-10'>
				<Button type='submit' disabled={isSubmitting}>
					{isSubmitting ? 'Збереження...' : 'Зберегти зміни'}
				</Button>
			</div>
		</form>
	)
}

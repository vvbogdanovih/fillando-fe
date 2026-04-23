'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/common/components/ui/button'
import { toSlug } from '@/common/utils'
import { UI_URLS } from '@/common/constants'
import { NameBlock } from './NameBlock'
import { CategoryBlock } from './CategoryBlock'
import { DescriptionBlock, type DescriptionValue } from './DescriptionBlock'
import { AttributesBlock } from './AttributesBlock'
import { VariantsBlock } from './VariantsBlock'
import type { ImageUploadItem } from './ImageDropzone'
import { productsApi } from '../products.api'
import { productFormSchema, type ProductFormValues } from '../products.schema'
import { categoriesApi } from '../../categories/categories.api'

const DEFAULT_VARIANT = { v_value: null, price: '', stock: '', images: [], vendor_product_sku: '' }

export const ProductForm = () => {
	const router = useRouter()
	const descriptionRef = useRef<DescriptionValue | null>(null)

	// Per-variant image upload state (parallel to RHF variants array)
	const [variantImageUploads, setVariantImageUploads] = useState<ImageUploadItem[][]>([[]])

	// Track the selected subcategory to load required attributes
	const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('')

	const {
		control,
		register,
		handleSubmit,
		setError,
		watch,
		setValue,
		formState: { errors, isSubmitting }
	} = useForm<ProductFormValues>({
		resolver: zodResolver(productFormSchema),
		defaultValues: {
			name: '',
			vendor_id: '',
			category_id: '',
			subcategory_id: '',
			attributes: [],
			has_variants: false,
			variant_type_key: null,
			variants: [DEFAULT_VARIANT]
		}
	})

	const attributesFieldArray = useFieldArray({ control, name: 'attributes' })
	const variantsFieldArray = useFieldArray({ control, name: 'variants' })

	const watchedName = useWatch({ control, name: 'name' })
	const watchedCategoryId = useWatch({ control, name: 'category_id' })
	const watchedHasVariants = useWatch({ control, name: 'has_variants' })
	const watchedVariantTypeKey = useWatch({ control, name: 'variant_type_key' })
	const watchedAttributes = useWatch({ control, name: 'attributes' })

	// Reset variant count to 1 when toggling off
	useEffect(() => {
		if (!watchedHasVariants) {
			// Keep only first variant, reset its v_value
			const current = variantsFieldArray.fields
			for (let i = current.length - 1; i > 0; i--) {
				variantsFieldArray.remove(i)
			}
			setValue('variants.0.v_value', null)
			setValue('variant_type_key', null)
			setVariantImageUploads(prev => [prev[0] ?? []])
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [watchedHasVariants])

	// Sync the first variant's v_value with the variant-type attribute's current value.
	// This keeps them in lock-step: selecting a different attribute or editing its value
	// is instantly reflected in the first variant card.
	const variantTypeAttrValue = watchedVariantTypeKey
		? (watchedAttributes.find(a => a.k === watchedVariantTypeKey)?.v ?? null)
		: null

	useEffect(() => {
		if (!watchedHasVariants || !watchedVariantTypeKey || variantTypeAttrValue === null) return
		setValue('variants.0.v_value', String(variantTypeAttrValue))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [variantTypeAttrValue, watchedVariantTypeKey, watchedHasVariants])

	// Fetch categories to resolve required attributes for the selected subcategory
	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getWithSubcategories()
	})

	const selectedSubcategory = categories
		.flatMap(c => c.subcategories)
		.find(s => s._id === selectedSubcategoryId)

	const requiredAttrs = selectedSubcategory?.required_attributes ?? []

	// When subcategory changes, re-seed required attributes while preserving custom ones
	useEffect(() => {
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

	const handleImagesChange = useCallback((variantIndex: number, images: ImageUploadItem[]) => {
		setVariantImageUploads(prev => {
			const next = [...prev]
			next[variantIndex] = images
			return next
		})
	}, [])

	const handleAddVariant = useCallback(() => {
		variantsFieldArray.append({
			v_value: '',
			price: '',
			stock: '',
			images: [],
			vendor_product_sku: ''
		})
		setVariantImageUploads(prev => [...prev, []])
	}, [variantsFieldArray])

	const handleRemoveVariant = useCallback(
		(index: number) => {
			variantsFieldArray.remove(index)
			setVariantImageUploads(prev => prev.filter((_, i) => i !== index))
		},
		[variantsFieldArray]
	)

	const onSubmit = handleSubmit(async values => {
		// 1. Collect variant slugs + SKUs for pre-submit validation
		const variantSlugsAndSkus = values.variants.map(v => ({
			slug: toSlug(
				values.has_variants && v.v_value ? `${values.name} ${v.v_value}` : values.name
			),
			sku: v.sku
		}))

		try {
			const { slugs: takenSlugs, skus: takenSkus } = await productsApi.validate({
				slugs: variantSlugsAndSkus.map(v => v.slug),
				skus: variantSlugsAndSkus
					.map(v => v.sku)
					.filter((s): s is string => s !== undefined)
			})

			let hasConflict = false
			variantSlugsAndSkus.forEach(({ slug, sku }, i) => {
				if (takenSlugs.includes(slug)) {
					setError(`variants.${i}.v_value`, {
						message: `Slug "${slug}" вже зайнятий`
					})
					hasConflict = true
				}
				if (sku !== undefined && takenSkus.includes(sku)) {
					setError(`variants.${i}.sku`, { message: 'Цей SKU вже використовується' })
					hasConflict = true
				}
			})
			if (hasConflict) return
		} catch {
			// If validate endpoint isn't available yet, proceed with submission
		}

		// 2. Collect description from Quill (written to ref by DescriptionBlock.onChange)
		const description =
			descriptionRef.current?.html?.replace(/<p><br><\/p>/, '') !== ''
				? descriptionRef.current
				: null

		// 3. Resolve variant_type from attributes
		let variantType: { key: string; label: string } | null = null
		if (values.has_variants && values.variant_type_key) {
			const attr = values.attributes.find(a => a.k === values.variant_type_key)
			if (attr) variantType = { key: attr.k, label: attr.l }
		}

		// 4. Build create payload (images: [] — will be uploaded after creation)
		const createPayload = {
			name: values.name,
			vendor_id: values.vendor_id,
			category_id: values.category_id,
			subcategory_id: values.subcategory_id,
			description,
			attributes: values.attributes,
			variant_type: variantType,
			variants: values.variants.map(v => ({
				v_value: values.has_variants ? (v.v_value ?? null) : null,
				price: Number(v.price),
				stock: Number(v.stock),
				images: [],
				vendor_product_sku: v.vendor_product_sku || undefined
			}))
		}

		// 5. Extract pending files per variant
		const variantFiles = variantImageUploads.map(uploads =>
			uploads.filter(u => u.status === 'pending' && u.file).map(u => u.file!)
		)

		try {
			await productsApi.createWithImages(createPayload, variantFiles)
			toast.success('Продукт створено')
			router.push(UI_URLS.ADMIN.PRODUCTS)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Помилка збереження'
			toast.error(message)
		}
	})

	return (
		<form onSubmit={onSubmit} className='flex flex-col gap-6'>
			<NameBlock control={control} errors={errors} register={register} />

			<CategoryBlock
				control={control}
				errors={errors}
				setValue={setValue}
				watchCategoryId={watchedCategoryId}
				onSubcategoryChange={setSelectedSubcategoryId}
			/>

			<DescriptionBlock descriptionRef={descriptionRef} />

			<AttributesBlock
				fieldArray={attributesFieldArray}
				errors={errors}
				requiredAttrs={requiredAttrs}
			/>

			<VariantsBlock
				control={control}
				register={register}
				errors={errors}
				fieldArray={variantsFieldArray}
				hasVariants={watchedHasVariants}
				variantTypeKey={watchedVariantTypeKey}
				isFirstVariantLocked={watchedHasVariants && !!watchedVariantTypeKey}
				productName={watchedName}
				attributes={watchedAttributes}
				variantImageUploads={variantImageUploads}
				onImagesChange={handleImagesChange}
				onAddVariant={handleAddVariant}
				onRemoveVariant={handleRemoveVariant}
			/>

			<div className='flex gap-3 pb-10'>
				<Button type='submit' disabled={isSubmitting}>
					{isSubmitting ? 'Збереження...' : 'Створити продукт'}
				</Button>
				<Button
					type='button'
					variant='outline'
					onClick={() => router.push(UI_URLS.ADMIN.PRODUCTS)}
					disabled={isSubmitting}
				>
					Скасувати
				</Button>
			</div>
		</form>
	)
}

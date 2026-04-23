'use client'

import { useEffect, useRef } from 'react'
import { Controller, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { categoriesApi } from '../../categories/categories.api'
import { vendorsApi } from '../../vendors/vendors.api'
import type { ProductFormValues } from '../products.schema'

interface CategoryBlockProps {
	control: Control<ProductFormValues>
	errors: FieldErrors<ProductFormValues>
	setValue: UseFormSetValue<ProductFormValues>
	watchCategoryId: string
	onSubcategoryChange?: (subcategoryId: string) => void
}

export const CategoryBlock = ({
	control,
	errors,
	setValue,
	watchCategoryId,
	onSubcategoryChange
}: CategoryBlockProps) => {
	const { data: categories = [], isLoading } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getWithSubcategories()
	})

	const { data: vendors = [], isLoading: isVendorsLoading } = useQuery({
		queryKey: ['vendors'],
		queryFn: () => vendorsApi.getAll()
	})

	const selectedCategory = categories.find(c => c._id === watchCategoryId)
	const subcategories = selectedCategory?.subcategories ?? []

	// Only reset subcategory when the category actually changes (not on initial mount).
	// Comparing with the previous value is Strict Mode-safe, unlike a "skip first run" ref.
	const prevCategoryId = useRef(watchCategoryId)

	useEffect(() => {
		if (prevCategoryId.current === watchCategoryId) return
		prevCategoryId.current = watchCategoryId
		setValue('subcategory_id', '')
		onSubcategoryChange?.('')
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [watchCategoryId])

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<h2 className='text-sm font-semibold text-gray-900'>Категорія та вендор</h2>

			{/* Vendor */}
			<div className='flex flex-col gap-1.5'>
				<Label>Вендор</Label>
				<Controller
					control={control}
					name='vendor_id'
					render={({ field }) => (
						<Select
							value={field.value}
							onValueChange={field.onChange}
							disabled={isVendorsLoading}
						>
							<SelectTrigger className='w-72' aria-invalid={!!errors.vendor_id}>
								<SelectValue
									placeholder={
										isVendorsLoading ? 'Завантаження...' : 'Оберіть вендора'
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{vendors.map(v => (
									<SelectItem key={v._id} value={v._id}>
										{v.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
				{errors.vendor_id && (
					<p className='text-destructive text-xs'>{errors.vendor_id.message}</p>
				)}
			</div>

			<div className='flex gap-4'>
				{/* Category select */}
				<div className='flex flex-1 flex-col gap-1.5'>
					<Label>Категорія</Label>
					<Controller
						control={control}
						name='category_id'
						render={({ field }) => (
							<Select
								value={field.value}
								onValueChange={field.onChange}
								disabled={isLoading}
							>
								<SelectTrigger
									className='w-full'
									aria-invalid={!!errors.category_id}
								>
									<SelectValue
										placeholder={
											isLoading ? 'Завантаження...' : 'Оберіть категорію'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{categories.map(cat => (
										<SelectItem key={cat._id} value={cat._id}>
											{cat.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
					{errors.category_id && (
						<p className='text-destructive text-xs'>{errors.category_id.message}</p>
					)}
				</div>

				{/* Subcategory select */}
				<div className='flex flex-1 flex-col gap-1.5'>
					<Label>Підкатегорія</Label>
					<Controller
						control={control}
						name='subcategory_id'
						render={({ field }) => (
							<Select
								value={field.value}
								onValueChange={val => {
									field.onChange(val)
									onSubcategoryChange?.(val)
								}}
								disabled={!watchCategoryId || subcategories.length === 0}
							>
								<SelectTrigger
									className='w-full'
									aria-invalid={!!errors.subcategory_id}
								>
									<SelectValue
										placeholder={
											!watchCategoryId
												? 'Спочатку оберіть категорію'
												: subcategories.length === 0
													? 'Немає підкатегорій'
													: 'Оберіть підкатегорію'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{subcategories.map(sub => (
										<SelectItem key={sub._id} value={sub._id}>
											{sub.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
					{errors.subcategory_id && (
						<p className='text-destructive text-xs'>{errors.subcategory_id.message}</p>
					)}
				</div>
			</div>
		</section>
	)
}

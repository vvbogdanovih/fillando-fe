'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileDown } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Checkbox } from '@/common/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/common/components/ui/dialog'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import type { CategoryOption } from '../categories/categories.schema'
import { productsApi } from './products.api'
import type { PageOrientation } from './products.schema'
import { buildPriceListPayload } from './products.utils'

// Each category brings its own characteristic columns (filament: nine): a portrait page breaks
// their headers mid-word, so landscape is the default (owner's choice still wins).
const DEFAULT_ORIENTATION: PageOrientation = 'landscape'

const ORIENTATION_LABELS: Record<PageOrientation, string> = {
	portrait: 'Вертикальна (книжкова)',
	landscape: 'Горизонтальна (альбомна)'
}

interface PriceListModalProps {
	categories: Pick<CategoryOption, '_id' | 'name'>[]
}

export const PriceListModal = ({ categories }: PriceListModalProps) => {
	const [open, setOpen] = useState(false)
	const [selected, setSelected] = useState<string[]>([])
	const [inStockOnly, setInStockOnly] = useState(false)
	const [orientation, setOrientation] = useState<PageOrientation>(DEFAULT_ORIENTATION)

	// An empty selection means "all", so unchecking the last category collapses back to
	// all rather than becoming an invalid empty filter.
	const allCategories = selected.length === 0 || selected.length === categories.length

	const toggleCategory = (id: string) =>
		setSelected(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]))

	const priceListMutation = useMutation({
		mutationFn: () =>
			productsApi.downloadPriceList(
				buildPriceListPayload({
					categoryIds: selected,
					allCategories,
					inStockOnly,
					orientation
				})
			),
		onSuccess: () => {
			toast.success('Прайс-лист завантажено')
			setOpen(false)
		},
		// Bare axios bypasses the httpService interceptor, so there is no auto-toast here.
		onError: (error: unknown) => {
			toast.error(
				error instanceof Error && error.message
					? error.message
					: 'Не вдалося сформувати прайс-лист'
			)
		}
	})

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setSelected([])
			setInStockOnly(false)
			setOrientation(DEFAULT_ORIENTATION)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size='sm' variant='outline'>
					<FileDown className='size-4 sm:mr-2' />
					<span className='hidden sm:inline'>Прайс-лист</span>
				</Button>
			</DialogTrigger>
			<DialogContent className='max-w-md'>
				<DialogHeader>
					<DialogTitle>Генерація прайс-листа</DialogTitle>
					<DialogDescription>
						Наявність і ціни обраних категорій, кожна — окремою таблицею зі своїми
						характеристиками.
					</DialogDescription>
				</DialogHeader>
				<div className='grid gap-4'>
					<div className='space-y-2'>
						<Label>Категорії</Label>
						<div className='max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-3'>
							<div className='mb-1 flex items-center gap-2 border-b pb-2'>
								<Checkbox
									id='price-list-cat-all'
									checked={allCategories}
									onCheckedChange={() => setSelected([])}
								/>
								<Label
									htmlFor='price-list-cat-all'
									className='cursor-pointer text-sm font-normal'
								>
									Всі категорії
								</Label>
							</div>
							{categories.map(category => (
								<div key={category._id} className='flex items-center gap-2'>
									<Checkbox
										id={`price-list-cat-${category._id}`}
										checked={selected.includes(category._id)}
										onCheckedChange={() => toggleCategory(category._id)}
									/>
									<Label
										htmlFor={`price-list-cat-${category._id}`}
										className='cursor-pointer text-sm font-normal'
									>
										{category.name}
									</Label>
								</div>
							))}
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Checkbox
							id='price-list-in-stock'
							checked={inStockOnly}
							onCheckedChange={checked => setInStockOnly(checked === true)}
						/>
						<Label
							htmlFor='price-list-in-stock'
							className='cursor-pointer text-sm font-normal'
						>
							Тільки в наявності
						</Label>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='price-list-orientation'>Орієнтація сторінки</Label>
						<Select
							value={orientation}
							onValueChange={value => setOrientation(value as PageOrientation)}
						>
							<SelectTrigger id='price-list-orientation' className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(ORIENTATION_LABELS) as PageOrientation[]).map(
									value => (
										<SelectItem key={value} value={value}>
											{ORIENTATION_LABELS[value]}
										</SelectItem>
									)
								)}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
						onClick={() => priceListMutation.mutate()}
						disabled={priceListMutation.isPending}
					>
						{priceListMutation.isPending ? 'Генерація...' : 'Завантажити'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

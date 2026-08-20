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
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import type { Category } from '../categories/categories.schema'
import { productsApi } from './products.api'
import type { PageOrientation } from './products.schema'
import { buildPriceListPayload } from './products.utils'

const DEFAULT_TIER1 = '10'
const DEFAULT_TIER2 = '15'
const DEFAULT_ORIENTATION: PageOrientation = 'portrait'

const ORIENTATION_LABELS: Record<PageOrientation, string> = {
	portrait: 'Вертикальна (книжкова)',
	landscape: 'Горизонтальна (альбомна)'
}

interface PriceListModalProps {
	categories: Category[]
}

export const PriceListModal = ({ categories }: PriceListModalProps) => {
	const [open, setOpen] = useState(false)
	const [selected, setSelected] = useState<string[]>([])
	const [inStockOnly, setInStockOnly] = useState(false)
	// Percents are strings: with numeric state, clearing a `type='number'` input yields
	// NaN and the controlled value fights the user mid-typing.
	const [tier1, setTier1] = useState(DEFAULT_TIER1)
	const [tier2, setTier2] = useState(DEFAULT_TIER2)
	const [orientation, setOrientation] = useState<PageOrientation>(DEFAULT_ORIENTATION)

	// An empty selection means "all", so unchecking the last category collapses back to
	// all rather than becoming an invalid empty filter.
	const allCategories = selected.length === 0 || selected.length === categories.length

	const tier1Value = Number(tier1)
	const tier2Value = Number(tier2)
	const percentsFilled = tier1.trim() !== '' && tier2.trim() !== ''
	const percentsInRange =
		percentsFilled &&
		Number.isFinite(tier1Value) &&
		Number.isFinite(tier2Value) &&
		tier1Value >= 0 &&
		tier1Value <= 100 &&
		tier2Value >= 0 &&
		tier2Value <= 100
	const tiersOrdered = percentsInRange && tier1Value < tier2Value

	const toggleCategory = (id: string) =>
		setSelected(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]))

	const priceListMutation = useMutation({
		mutationFn: () =>
			productsApi.downloadPriceList(
				buildPriceListPayload({
					categoryIds: selected,
					allCategories,
					inStockOnly,
					tier1Percent: tier1,
					tier2Percent: tier2,
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
			setTier1(DEFAULT_TIER1)
			setTier2(DEFAULT_TIER2)
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
						Оберіть категорії та відсотки оптових знижок для генерації PDF прайс-листа.
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
					<div className='grid grid-cols-2 gap-3'>
						<div className='space-y-2'>
							<Label htmlFor='price-list-tier1'>Знижка від 50кг, %</Label>
							<Input
								id='price-list-tier1'
								type='number'
								min={0}
								max={100}
								step={1}
								value={tier1}
								aria-invalid={percentsFilled && !percentsInRange}
								onChange={e => setTier1(e.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='price-list-tier2'>Знижка від 100кг, %</Label>
							<Input
								id='price-list-tier2'
								type='number'
								min={0}
								max={100}
								step={1}
								value={tier2}
								aria-invalid={percentsFilled && !percentsInRange}
								onChange={e => setTier2(e.target.value)}
							/>
						</div>
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
					{percentsFilled && !percentsInRange && (
						<p className='text-destructive text-sm'>Знижка має бути в межах 0–100%</p>
					)}
					{percentsInRange && !tiersOrdered && (
						<p className='text-destructive text-sm'>
							Знижка від 100кг має бути більшою за знижку від 50кг
						</p>
					)}
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => handleOpenChange(false)}>
						Скасувати
					</Button>
					<Button
						onClick={() => priceListMutation.mutate()}
						disabled={!tiersOrdered || priceListMutation.isPending}
					>
						{priceListMutation.isPending ? 'Генерація...' : 'Завантажити'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

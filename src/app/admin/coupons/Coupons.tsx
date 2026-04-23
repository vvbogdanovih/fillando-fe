'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, type UseFormSetError } from 'react-hook-form'
import toast from 'react-hot-toast'
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Badge } from '@/common/components/ui/badge'
import { Switch } from '@/common/components/ui/switch'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/common/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { couponsApi } from './coupons.api'
import { couponFormSchema, type Coupon, type CouponFormValues } from './coupons.schema'

type PanelState = { mode: 'create' } | { mode: 'edit'; couponId: string }
type StatusFilter = 'all' | 'active' | 'inactive'

function toDateTimeLocal(dateString: string): string {
	const d = new Date(dateString)
	if (Number.isNaN(d.getTime())) return ''
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toApiDate(value: string): string {
	return new Date(value).toISOString()
}

function mapApiFormError(message: string, setError: UseFormSetError<CouponFormValues>) {
	const normalized = message.toLowerCase()
	if (normalized.includes('discount_percent')) {
		setError('discount_percent', { message })
		return
	}
	if (normalized.includes('valid_until')) {
		setError('valid_until', { message })
		return
	}
	if (normalized.includes('is_active')) {
		setError('is_active', { message })
	}
}

function formatDateTime(dateString: string): string {
	const d = new Date(dateString)
	if (Number.isNaN(d.getTime())) return '—'
	return d.toLocaleString('uk-UA')
}

function CouponForm({
	mode,
	initial,
	onCancel,
	onCreated
}: {
	mode: PanelState['mode']
	initial?: Coupon
	onCancel?: () => void
	onCreated?: (coupon: Coupon) => void
}) {
	const queryClient = useQueryClient()

	const form = useForm<CouponFormValues>({
		resolver: zodResolver(couponFormSchema),
		mode: 'onChange',
		defaultValues: {
			discount_percent: initial?.discount_percent ?? 10,
			valid_until: initial ? toDateTimeLocal(initial.valid_until) : '',
			is_active: initial?.is_active ?? true
		}
	})

	const {
		register,
		handleSubmit,
		formState: { errors, isValid, isSubmitting },
		setValue,
		watch
	} = form
	const isActive = watch('is_active')

	useEffect(() => {
		if (!initial) return
		form.reset({
			discount_percent: initial.discount_percent,
			valid_until: toDateTimeLocal(initial.valid_until),
			is_active: initial.is_active
		})
	}, [initial, form])

	const createMutation = useMutation({
		mutationFn: (values: CouponFormValues) =>
			couponsApi.create({
				discount_percent: values.discount_percent,
				valid_until: toApiDate(values.valid_until),
				is_active: values.is_active
			}),
		onSuccess: async created => {
			await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
			toast.success(`Купон створено: #${created.number} (${created.code})`)
			onCreated?.(created)
		},
		onError: (error: Error) => {
			mapApiFormError(error.message || '', form.setError)
			toast.error(error.message || 'Не вдалося створити купон')
		}
	})

	const updateMutation = useMutation({
		mutationFn: (values: CouponFormValues) => {
			if (!initial?.id) throw new Error('Не знайдено ID купона для оновлення')
			return couponsApi.update(initial.id, {
				discount_percent: values.discount_percent,
				valid_until: toApiDate(values.valid_until),
				is_active: values.is_active
			})
		},
		onSuccess: async updated => {
			await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
			toast.success(`Купон #${updated.number} оновлено`)
		},
		onError: (error: Error) => {
			mapApiFormError(error.message || '', form.setError)
			toast.error(error.message || 'Не вдалося оновити купон')
		}
	})

	const pending = isSubmitting || createMutation.isPending || updateMutation.isPending

	return (
		<Card className='h-fit'>
			<CardHeader className='border-b'>
				<CardTitle>{mode === 'create' ? 'Новий купон' : 'Редагування купона'}</CardTitle>
			</CardHeader>
			<CardContent className='space-y-4 pt-5'>
				{mode === 'edit' && initial && (
					<div className='grid gap-3 sm:grid-cols-2'>
						<div className='space-y-1'>
							<Label>Number</Label>
							<Input value={String(initial.number)} disabled readOnly />
						</div>
						<div className='space-y-1'>
							<Label>Code</Label>
							<Input value={initial.code} disabled readOnly />
						</div>
					</div>
				)}

				<form
					onSubmit={handleSubmit(values => {
						if (mode === 'create') {
							createMutation.mutate(values)
							return
						}
						updateMutation.mutate(values)
					})}
					className='space-y-4'
				>
					<div className='space-y-2'>
						<Label htmlFor='discount_percent'>Discount %</Label>
						<Input
							id='discount_percent'
							type='number'
							min={0}
							max={100}
							step={1}
							{...register('discount_percent', { valueAsNumber: true })}
							aria-invalid={!!errors.discount_percent}
						/>
						{errors.discount_percent && (
							<p className='text-destructive text-sm'>{errors.discount_percent.message}</p>
						)}
					</div>

					<div className='space-y-2'>
						<Label htmlFor='valid_until'>Valid until</Label>
						<Input
							id='valid_until'
							type='datetime-local'
							{...register('valid_until')}
							aria-invalid={!!errors.valid_until}
						/>
						{errors.valid_until && (
							<p className='text-destructive text-sm'>{errors.valid_until.message}</p>
						)}
					</div>

					<div className='flex items-center justify-between rounded-lg border p-3'>
						<div>
							<p className='text-sm font-medium'>Активний купон</p>
							<p className='text-muted-foreground text-xs'>
								Купон доступний для checkout, якщо увімкнений.
							</p>
						</div>
						<Switch
							checked={isActive}
							onCheckedChange={checked =>
								setValue('is_active', checked, { shouldDirty: true, shouldValidate: true })
							}
							disabled={pending}
							aria-label='toggle coupon active'
						/>
					</div>

					<div className='flex gap-2'>
						<Button type='submit' disabled={!isValid || pending}>
							{pending
								? 'Збереження...'
								: mode === 'create'
									? 'Створити купон'
									: 'Оновити купон'}
						</Button>
						{onCancel && (
							<Button type='button' variant='outline' onClick={onCancel} disabled={pending}>
								Скасувати
							</Button>
						)}
					</div>
				</form>
			</CardContent>
		</Card>
	)
}

export function Coupons() {
	const [panel, setPanel] = useState<PanelState>({ mode: 'create' })
	const [page, setPage] = useState(1)
	const [limit, setLimit] = useState(20)
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const [searchInput, setSearchInput] = useState('')
	const [searchQuery, setSearchQuery] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
	const queryClient = useQueryClient()

	useEffect(() => {
		const t = setTimeout(() => {
			setSearchQuery(searchInput.trim().toUpperCase())
			setPage(1)
		}, 350)
		return () => clearTimeout(t)
	}, [searchInput])

	const isActiveParam = statusFilter === 'all' ? undefined : statusFilter === 'active'

	const { data, isLoading, isError, refetch, isFetching } = useQuery({
		queryKey: ['admin-coupons', page, limit, statusFilter, searchQuery],
		queryFn: () =>
			couponsApi.getAll({
				page,
				limit,
				is_active: isActiveParam,
				q: searchQuery || undefined
			})
	})

	const coupons = data?.items ?? []
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / limit))
	const canPrev = page > 1
	const canNext = page < totalPages

	const activeToggleMutation = useMutation({
		mutationFn: (coupon: Coupon) => {
			return couponsApi.update(coupon.id, {
				discount_percent: coupon.discount_percent,
				valid_until: coupon.valid_until,
				is_active: !coupon.is_active
			})
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Не вдалося оновити статус купона')
		}
	})

	const deleteMutation = useMutation({
		mutationFn: (couponId: string) => couponsApi.delete(couponId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
			toast.success('Купон видалено')
			setDeleteTarget(null)
			if (panel.mode === 'edit') {
				setPanel({ mode: 'create' })
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Не вдалося видалити купон')
		}
	})

	const editingId = panel.mode === 'edit' ? panel.couponId : undefined
	const { data: editingCoupon } = useQuery({
		queryKey: ['admin-coupon', editingId],
		queryFn: () => couponsApi.getById(editingId!),
		enabled: Boolean(editingId)
	})

	const sortedCoupons = useMemo(
		() =>
			[...coupons].sort((a, b) => {
				const aNum = Number(a.number)
				const bNum = Number(b.number)
				if (Number.isFinite(aNum) && Number.isFinite(bNum)) return bNum - aNum
				return String(b.number).localeCompare(String(a.number))
			}),
		[coupons]
	)

	return (
		<div className='grid gap-6 p-6 lg:grid-cols-[1fr_360px]'>
			<Card>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>Discount coupons</CardTitle>
						<Button variant='outline' onClick={() => setPanel({ mode: 'create' })}>
							<PlusIcon className='size-4' />
							Новий купон
						</Button>
					</div>
					<div className='mt-4 grid gap-3 sm:grid-cols-[1fr_180px_130px]'>
						<div className='relative'>
							<SearchIcon className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
							<Input
								placeholder='Пошук по коду...'
								value={searchInput}
								onChange={e => setSearchInput(e.target.value)}
								className='pl-9'
							/>
						</div>

						<Select
							value={statusFilter}
							onValueChange={value => {
								setStatusFilter(value as StatusFilter)
								setPage(1)
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder='Статус' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>Всі</SelectItem>
								<SelectItem value='active'>Активні</SelectItem>
								<SelectItem value='inactive'>Неактивні</SelectItem>
							</SelectContent>
						</Select>

						<Select
							value={String(limit)}
							onValueChange={value => {
								setLimit(Number(value))
								setPage(1)
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder='Ліміт' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='10'>10 / стор</SelectItem>
								<SelectItem value='20'>20 / стор</SelectItem>
								<SelectItem value='50'>50 / стор</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent className='pt-5'>
					{isLoading ? (
						<p className='text-sm text-gray-500'>Завантаження...</p>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>Не вдалося завантажити купони</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : coupons.length === 0 ? (
						<p className='text-sm text-gray-500'>Ще немає створених купонів</p>
					) : (
						<div className='space-y-4'>
							<div className='overflow-x-auto'>
							<table className='w-full min-w-[720px] text-sm'>
								<thead>
									<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
										<th className='px-3 py-2'>Number</th>
										<th className='px-3 py-2'>Code</th>
										<th className='px-3 py-2'>Discount %</th>
										<th className='px-3 py-2'>Valid until</th>
										<th className='px-3 py-2'>Active</th>
										<th className='px-3 py-2 text-right'>Дії</th>
									</tr>
								</thead>
								<tbody>
									{sortedCoupons.map(coupon => (
										<tr key={coupon.id} className='border-b'>
											<td className='px-3 py-2 font-medium'>{coupon.number}</td>
											<td className='px-3 py-2 font-mono'>{coupon.code}</td>
											<td className='px-3 py-2'>{coupon.discount_percent}%</td>
											<td className='px-3 py-2'>{formatDateTime(coupon.valid_until)}</td>
											<td className='px-3 py-2'>
												<div className='flex items-center gap-2'>
													<Badge variant={coupon.is_active ? 'default' : 'secondary'}>
														{coupon.is_active ? 'Активний' : 'Неактивний'}
													</Badge>
													<Switch
														checked={coupon.is_active}
														disabled={activeToggleMutation.isPending}
														onCheckedChange={() => activeToggleMutation.mutate(coupon)}
														aria-label={`toggle coupon ${coupon.code}`}
													/>
												</div>
											</td>
											<td className='px-3 py-2 text-right'>
												<div className='flex justify-end gap-1'>
													<Button
														variant='ghost'
														size='sm'
														onClick={() => setPanel({ mode: 'edit', couponId: coupon.id })}
													>
														<PencilIcon className='size-4' />
														Редагувати
													</Button>
													<Button
														variant='ghost'
														size='sm'
														onClick={() => setDeleteTarget(coupon)}
													>
														<Trash2Icon className='size-4' />
														Видалити
													</Button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
							<div className='flex items-center justify-between'>
								<p className='text-muted-foreground text-xs'>
									Всього: {total} • Сторінка {page} з {totalPages}
									{isFetching ? ' • Оновлення...' : ''}
								</p>
								<div className='flex gap-2'>
									<Button
										variant='outline'
										size='sm'
										disabled={!canPrev || isFetching}
										onClick={() => setPage(p => Math.max(1, p - 1))}
									>
										Попередня
									</Button>
									<Button
										variant='outline'
										size='sm'
										disabled={!canNext || isFetching}
										onClick={() => setPage(p => Math.min(totalPages, p + 1))}
									>
										Наступна
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<div>
				{panel.mode === 'create' ? (
					<CouponForm
						mode='create'
						onCreated={created => {
							setPanel({ mode: 'edit', couponId: created.id })
							setPage(1)
						}}
					/>
				) : (
					<CouponForm
						mode='edit'
						initial={editingCoupon}
						onCancel={() => setPanel({ mode: 'create' })}
					/>
				)}
			</div>

			<Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Видалити купон?</DialogTitle>
						<DialogDescription>
							Цю дію не можна скасувати. Купон{' '}
							{deleteTarget ? `#${deleteTarget.number} (${deleteTarget.code})` : ''} буде видалено.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setDeleteTarget(null)}
							disabled={deleteMutation.isPending}
						>
							Скасувати
						</Button>
						<Button
							variant='destructive'
							onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? 'Видалення...' : 'Видалити'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

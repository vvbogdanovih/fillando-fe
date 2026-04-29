'use client'

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Button } from '@/common/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { Badge } from '@/common/components/ui/badge'
import { usersApi } from './users.api'
import { roleValues, authMethodValues, type UserRole } from './users.schema'

const ROLE_LABELS: Record<UserRole, string> = {
	USER: 'Користувач',
	ADMIN: 'Адміністратор'
}

const AUTH_METHOD_LABELS: Record<string, string> = {
	EMAIL: 'Email',
	GOOGLE: 'Google',
	GITHUB: 'GitHub'
}

function formatDate(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return '—'
	return date.toLocaleString('uk-UA')
}

function truncateId(id: string): string {
	return id.length > 8 ? `${id.slice(0, 4)}...${id.slice(-4)}` : id
}

function CopyCell({
	value,
	children,
	className
}: {
	value: string
	children: React.ReactNode
	className?: string
}) {
	const copy = useCallback(() => {
		navigator.clipboard.writeText(value).then(
			() => toast.success('Скопійовано'),
			() => toast.error('Не вдалося скопіювати')
		)
	}, [value])

	return (
		<td
			className={`cursor-pointer select-none px-3 py-3 hover:text-primary ${className ?? ''}`}
			title={`Натисніть, щоб скопіювати: ${value}`}
			onClick={copy}
		>
			{children}
		</td>
	)
}

export function Users() {
	const [page, setPage] = useState(1)
	const [limit, setLimit] = useState(20)
	const [role, setRole] = useState<'all' | UserRole>('all')

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ['admin-users', page, limit, role],
		queryFn: () =>
			usersApi.getAll({
				page,
				limit,
				role: role === 'all' ? undefined : role
			})
	})

	const users = data?.items ?? []
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / limit))

	return (
		<div className='p-6'>
			<Card>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>Користувачі</CardTitle>
						<div className='text-muted-foreground text-xs'>
							Всього: {total} {isFetching ? '• Оновлення...' : ''}
						</div>
					</div>
					<div className='mt-3 grid gap-3 sm:grid-cols-2'>
						<Select
							value={role}
							onValueChange={value => {
								setRole(value as 'all' | UserRole)
								setPage(1)
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder='Роль' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>Всі ролі</SelectItem>
								{roleValues.map(r => (
									<SelectItem key={r} value={r}>
										{ROLE_LABELS[r]}
									</SelectItem>
								))}
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
								<SelectItem value='10'>10 / сторінку</SelectItem>
								<SelectItem value='20'>20 / сторінку</SelectItem>
								<SelectItem value='50'>50 / сторінку</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent className='pt-5'>
					{isLoading ? (
						<div className='space-y-3'>
							{Array.from({ length: 6 }).map((_, index) => (
								<div key={index} className='h-16 animate-pulse rounded-md bg-gray-100' />
							))}
						</div>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>
								Не вдалося завантажити список користувачів
							</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : users.length === 0 ? (
						<p className='text-sm text-gray-500'>
							Користувачів за обраними фільтрами не знайдено
						</p>
					) : (
						<>
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[800px] text-sm'>
									<thead>
										<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
											<th className='px-3 py-2'>ID</th>
											<th className='px-3 py-2'>Ім'я</th>
											<th className='px-3 py-2'>Email</th>
											<th className='px-3 py-2'>Роль</th>
											<th className='px-3 py-2'>Авторизація</th>
											<th className='px-3 py-2'>Створено</th>
										</tr>
									</thead>
									<tbody>
										{users.map(user => (
											<tr key={user.id} className='border-b hover:bg-gray-50'>
												<CopyCell value={user.id} className='font-mono text-xs'>
													{truncateId(user.id)}
												</CopyCell>
												<CopyCell value={user.name}>{user.name}</CopyCell>
												<CopyCell value={user.email}>{user.email}</CopyCell>
												<td className='px-3 py-3'>
													<Badge
														variant={
															user.role === 'ADMIN' ? 'default' : 'secondary'
														}
													>
														{ROLE_LABELS[user.role]}
													</Badge>
												</td>
												<td className='px-3 py-3'>
													{AUTH_METHOD_LABELS[user.authMethod] ?? user.authMethod}
												</td>
												<td className='px-3 py-3'>{formatDate(user.createdAt)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className='mt-4 flex items-center justify-between'>
								<p className='text-muted-foreground text-xs'>
									Сторінка {page} з {totalPages}
								</p>
								<div className='flex gap-2'>
									<Button
										variant='outline'
										size='sm'
										disabled={page <= 1 || isFetching}
										onClick={() => setPage(prev => Math.max(1, prev - 1))}
									>
										Попередня
									</Button>
									<Button
										variant='outline'
										size='sm'
										disabled={page >= totalPages || isFetching}
										onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
									>
										Наступна
									</Button>
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

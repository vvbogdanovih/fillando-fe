'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { cn } from '@/common/utils/shad-cn.utils'
import { feedApi } from './feed.api'
import { EXCLUSION_LABELS, WARNING_COPY, type FeedStatus } from './feed.schema'

const QUERY_KEY = ['feed', 'status'] as const

const formatGeneratedAt = (iso: string) =>
	new Intl.DateTimeFormat('uk-UA', {
		hour: '2-digit',
		minute: '2-digit',
		day: 'numeric',
		month: 'long'
	}).format(new Date(iso))

/** «12:04, 2 вересня» → the next full hour after it, when the cron runs again. */
const nextHourAfter = (iso: string) => {
	const d = new Date(iso)
	d.setMinutes(0, 0, 0)
	d.setHours(d.getHours() + 1)
	return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(d)
}

const StatusBanner = ({ status }: { status: FeedStatus }) => {
	if (status.last_error && !status.xml_ready) {
		return (
			<div className='flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900'>
				<AlertTriangle className='mt-0.5 size-5 shrink-0' />
				<div>
					<p className='font-medium'>Фід не згенерувався</p>
					<p className='text-sm'>{status.last_error}</p>
				</div>
			</div>
		)
	}
	if (!status.xml_ready || !status.summary) {
		return (
			<div className='flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900'>
				<RefreshCwIcon className='mt-0.5 size-5 shrink-0 animate-spin' />
				<div>
					<p className='font-medium'>Фід ще генерується після запуску сервера</p>
					<p className='text-sm'>
						Публічна адреса відповідає 503 з Retry-After, доки перша генерація не завершиться.
					</p>
				</div>
			</div>
		)
	}
	return (
		<div className='flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900'>
			<div className='flex items-start gap-3'>
				<CheckIcon className='mt-0.5 size-5 shrink-0' />
				<div>
					<p className='font-medium'>
						Фід актуальний — згенеровано {formatGeneratedAt(status.summary.generated_at)}
					</p>
					<p className='text-sm'>
						{status.scheduled
							? `Наступна автогенерація о ${nextHourAfter(status.summary.generated_at)} (щогодини). `
							: 'Автогенерація в цьому процесі вимкнена (RUN_CRON). '}
						Google фетчить за власним розкладом — налаштовується в Merchant Center.
					</p>
					{status.last_error && (
						<p className='mt-1 text-sm text-amber-800'>
							Остання спроба не вдалася: {status.last_error}. Показано попередній фід.
						</p>
					)}
				</div>
			</div>
			<code className='shrink-0 text-xs text-emerald-800'>{status.feed_path}</code>
		</div>
	)
}

const Kpi = ({
	value,
	label,
	tone
}: {
	value: number
	label: string
	tone?: 'good' | 'warn' | 'bad'
}) => (
	<div className='rounded-xl border border-gray-200 bg-gray-50 p-4'>
		<p
			className={cn(
				'text-3xl font-bold tabular-nums',
				tone === 'good' && 'text-emerald-700',
				tone === 'warn' && value > 0 && 'text-amber-700',
				tone === 'bad' && value > 0 && 'text-red-700'
			)}
		>
			{value}
		</p>
		<p className='text-sm text-gray-500'>{label}</p>
	</div>
)

export const Feed = () => {
	const queryClient = useQueryClient()
	const { data: status, isLoading, isError, refetch } = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => feedApi.getStatus()
	})

	const regenerate = useMutation({
		mutationFn: () => feedApi.regenerate(),
		onSuccess: summary => {
			queryClient.setQueryData<FeedStatus>(QUERY_KEY, prev =>
				prev
					? { ...prev, xml_ready: true, generating: false, last_error: null, summary }
					: prev
			)
			toast.success(`Фід перегенеровано: ${summary.item_count} товарів`)
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Не вдалося перегенерувати фід')
			void refetch()
		}
	})

	const summary = status?.summary ?? null
	const warningCount = summary?.warnings.reduce((s, w) => s + w.count, 0) ?? 0

	return (
		<div className='p-6'>
			<Card className='h-fit'>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle className='flex items-center gap-2'>
							Google Feed
							<span className='rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700'>
								новий екран
							</span>
						</CardTitle>
						<div className='flex items-center gap-2'>
							<Button variant='outline' asChild>
								<a href={feedApi.publicXmlUrl()} target='_blank' rel='noreferrer'>
									<ExternalLinkIcon className='size-4' />
									Відкрити XML
								</a>
							</Button>
							<Button
								onClick={() => regenerate.mutate()}
								disabled={regenerate.isPending || isLoading || isError}
							>
								<RefreshCwIcon
									className={cn('size-4', regenerate.isPending && 'animate-spin')}
								/>
								{regenerate.isPending ? 'Генерується…' : 'Перегенерувати'}
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className='space-y-6 pt-5'>
					{isLoading ? (
						<p className='text-sm text-gray-500'>Завантаження...</p>
					) : isError || !status ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>Помилка завантаження статусу фіда</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : (
						<>
							<StatusBanner status={status} />

							{summary && (
								<>
									<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
										<Kpi value={summary.item_count} label='товарів у фіді' tone='good' />
										<Kpi
											value={summary.in_stock}
											label={`в наявності · ${summary.out_of_stock} немає`}
										/>
										<Kpi value={warningCount} label='попереджень' tone='warn' />
										<Kpi value={summary.excluded.length} label='виключено з фіда' tone='bad' />
									</div>

									<section className='space-y-2'>
										<h3 className='font-medium'>Виключено з фіда</h3>
										<p className='text-sm text-gray-500'>
											Ці товари Google не побачить узагалі — виправте причину й
											перегенеруйте.
										</p>
										{summary.excluded.length === 0 ? (
											<p className='rounded-lg border border-gray-200 p-3 text-sm text-gray-500'>
												Жодного виключення — усі активні варіанти у фіді.
											</p>
										) : (
											<div className='overflow-x-auto'>
												<table className='w-full min-w-[640px] text-sm'>
													<thead>
														<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
															<th className='px-3 py-2'>SKU</th>
															<th className='px-3 py-2'>Товар</th>
															<th className='px-3 py-2'>Причина</th>
														</tr>
													</thead>
													<tbody className='divide-y divide-gray-100'>
														{summary.excluded.map(row => (
															<tr key={row.sku}>
																<td className='px-3 py-2 font-mono text-xs'>{row.sku}</td>
																<td className='px-3 py-2'>{row.name}</td>
																<td className='px-3 py-2 text-red-700'>
																	{EXCLUSION_LABELS[row.reason]}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										)}
									</section>

									<section className='space-y-2'>
										<h3 className='font-medium'>Попередження</h3>
										<p className='text-sm text-gray-500'>
											Товар у фіді є, але без цих даних Google показує його гірше — або
											зовсім не показує в Shopping.
										</p>
										{summary.warnings.length === 0 ? (
											<p className='rounded-lg border border-gray-200 p-3 text-sm text-gray-500'>
												Попереджень немає.
											</p>
										) : (
											<ul className='space-y-2'>
												{summary.warnings.map(w => (
													<li
														key={w.code}
														className='flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900'
													>
														<div className='flex items-start gap-2'>
															<AlertTriangle className='mt-0.5 size-4 shrink-0' />
															<div>
																<p className='font-medium'>{WARNING_COPY[w.code].title}</p>
																<p className='text-sm'>
																	{WARNING_COPY[w.code].text}
																	{w.detail && Object.keys(w.detail).length > 0 && (
																		<>
																			{' — '}
																			{Object.entries(w.detail)
																				.map(([key, n]) => `${key}: ${n}`)
																				.join(', ')}
																		</>
																	)}
																</p>
																{w.skus.length > 0 && (
																	<p className='mt-1 font-mono text-xs text-amber-800'>
																		{w.skus.join(', ')}
																		{w.count > w.skus.length ? ` … ще ${w.count - w.skus.length}` : ''}
																	</p>
																)}
															</div>
														</div>
														<span className='shrink-0 text-sm font-medium'>
															{w.count}{' '}
															{w.code === 'no_google_product_category'
																? w.count === 1
																	? 'категорія'
																	: 'категорій'
																: w.count === 1
																	? 'товар'
																	: 'товарів'}
														</span>
													</li>
												))}
											</ul>
										)}
									</section>
								</>
							)}
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

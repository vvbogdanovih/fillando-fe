'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckIcon, CopyIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { productsCount } from '@/common/utils'
import { cn } from '@/common/utils/shad-cn.utils'
import { feedApi } from './feed.api'
import {
	EXCLUSION_LABELS,
	FAILURE_COPY,
	WARNING_COPY,
	warningCountLabel,
	type FeedStatus,
	type FeedWarning
} from './feed.schema'

const QUERY_KEY = ['feed', 'status'] as const

/** A generation is transient state: without polling the screen sits on «генерується» forever. */
export const GENERATING_POLL_MS = 3000

/** The cron fires at the top of every hour; a few minutes of slack for a run still in flight. */
const STALE_GRACE_MS = 5 * 60 * 1000

const formatGeneratedAt = (iso: string) =>
	new Intl.DateTimeFormat('uk-UA', {
		hour: '2-digit',
		minute: '2-digit',
		day: 'numeric',
		month: 'long'
	}).format(new Date(iso))

/** «12:04, 2 вересня» → the next full hour after it, when the cron runs again. */
const nextRunAfter = (iso: string) => {
	const d = new Date(iso)
	d.setMinutes(0, 0, 0)
	d.setHours(d.getHours() + 1)
	return d
}

const formatHour = (date: Date) =>
	new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(date)

/**
 * The scheduled run that should have replaced this XML has come and gone. Without this state the
 * header stayed green «Фід актуальний» after a failed cron and «Наступна автогенерація о …»
 * printed a time in the past (Plan-0005 I-38).
 */
const isStale = (status: FeedStatus, now = Date.now()) =>
	!!status.summary &&
	status.scheduled &&
	nextRunAfter(status.summary.generated_at).getTime() + STALE_GRACE_MS < now

/** «Діаметр»: 3 — the label the category form shows, never the raw attribute key (I-12). */
const warningDetail = (warning: FeedWarning): string | null => {
	if (warning.attributes && warning.attributes.length > 0) {
		return warning.attributes.map(a => `«${a.label}»: ${a.count}`).join(', ')
	}
	if (warning.detail && Object.keys(warning.detail).length > 0) {
		return Object.entries(warning.detail)
			.map(([key, n]) => `${key}: ${n}`)
			.join(', ')
	}
	return null
}

/** Merchant Center needs an origin — a relative path cannot be pasted into the cabinet. */
const FeedAddress = ({ path }: { path: string }) => {
	const url = feedApi.absoluteUrl(path)

	const copy = async () => {
		try {
			if (!navigator.clipboard) throw new Error('clipboard unavailable')
			await navigator.clipboard.writeText(url)
			toast.success('Адресу фіда скопійовано')
		} catch {
			toast.error('Не вдалося скопіювати — виділіть адресу вручну')
		}
	}

	return (
		<div className='flex shrink-0 items-center gap-1'>
			<code className='text-xs'>{url}</code>
			<Button
				type='button'
				size='icon-xs'
				variant='ghost'
				onClick={copy}
				aria-label='Скопіювати адресу фіда'
			>
				<CopyIcon className='size-3' />
			</Button>
		</div>
	)
}

const StatusBanner = ({ status }: { status: FeedStatus }) => {
	if (status.generating) {
		return (
			<div className='flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900'>
				<RefreshCwIcon className='mt-0.5 size-5 shrink-0 animate-spin' />
				<div>
					<p className='font-medium'>Фід генерується</p>
					<p className='text-sm'>
						Статус оновлюється автоматично — дочекайтеся завершення генерації.
					</p>
				</div>
			</div>
		)
	}
	if (!status.xml_ready || !status.summary) {
		if (status.last_error) {
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

	const stale = isStale(status)
	const nextRun = formatHour(nextRunAfter(status.summary.generated_at))

	return (
		<div
			className={cn(
				'flex items-start justify-between gap-3 rounded-xl border p-4',
				stale
					? 'border-amber-200 bg-amber-50 text-amber-900'
					: 'border-emerald-200 bg-emerald-50 text-emerald-900'
			)}
		>
			<div className='flex items-start gap-3'>
				{stale ? (
					<AlertTriangle className='mt-0.5 size-5 shrink-0' />
				) : (
					<CheckIcon className='mt-0.5 size-5 shrink-0' />
				)}
				<div>
					<p className='font-medium'>
						{stale ? 'Фід застарілий' : 'Фід актуальний'} — згенеровано{' '}
						{formatGeneratedAt(status.summary.generated_at)}
					</p>
					<p className='text-sm'>
						{!status.scheduled
							? 'Автогенерація в цьому процесі вимкнена (RUN_CRON). '
							: stale
								? `Автогенерація о ${nextRun} не спрацювала — перегенеруйте вручну. `
								: `Наступна автогенерація о ${nextRun} (щогодини). `}
						Google фетчить за власним розкладом — налаштовується в Merchant Center.
					</p>
					{status.last_error && (
						<p className='mt-1 text-sm text-amber-800'>
							Останній прогін не вдався: {status.last_error}. Google досі отримує XML
							від {formatGeneratedAt(status.summary.generated_at)}.
						</p>
					)}
				</div>
			</div>
			<FeedAddress path={status.feed_path} />
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
	const {
		data: status,
		isLoading,
		isError,
		refetch
	} = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => feedApi.getStatus(),
		refetchInterval: query => (query.state.data?.generating ? GENERATING_POLL_MS : false)
	})

	const regenerate = useMutation({
		mutationFn: () => feedApi.regenerate(),
		onSuccess: summary => {
			// A 2xx with `ok: false` is a refused publish: the served XML and the summary that
			// describes it stay exactly as they were, so only the error is new.
			if (!summary.ok) {
				const message =
					summary.error ??
					(summary.failure_reason ? FAILURE_COPY[summary.failure_reason] : null) ??
					'Фід не перегенеровано'
				queryClient.setQueryData<FeedStatus>(QUERY_KEY, prev =>
					prev ? { ...prev, generating: false, last_error: message } : prev
				)
				toast.error(message)
				return
			}
			queryClient.setQueryData<FeedStatus>(QUERY_KEY, prev =>
				prev
					? { ...prev, xml_ready: true, generating: false, last_error: null, summary }
					: prev
			)
			toast.success(`Фід перегенеровано: ${productsCount(summary.item_count)}`)
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Не вдалося перегенерувати фід')
			void refetch()
		}
	})

	const summary = status?.summary ?? null
	const xmlReady = !!status?.xml_ready

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
							{xmlReady ? (
								<Button variant='outline' asChild>
									<a href={feedApi.publicXmlUrl()} target='_blank' rel='noreferrer'>
										<ExternalLinkIcon className='size-4' />
										Відкрити XML
									</a>
								</Button>
							) : (
								// Before the first generation the public URL answers 503, so the
								// link would only show the shopper's Retry-After body.
								<Button
									variant='outline'
									disabled
									title='Фід ще не згенерований — публічна адреса відповідає 503'
								>
									<ExternalLinkIcon className='size-4' />
									Відкрити XML
								</Button>
							)}
							<Button
								onClick={() => regenerate.mutate()}
								disabled={
									regenerate.isPending ||
									isLoading ||
									isError ||
									!!status?.generating
								}
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
										{/* Kinds, not positions: the label says «попереджень», and
										    summing `count` across kinds is neither number. */}
										<Kpi value={summary.warning_kinds} label='попереджень' tone='warn' />
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
											Це перевірка повноти даних каталогу. Товари залишаються у фіді;
											попередження не означає, що Google їх відхилив.
										</p>
										{summary.warnings.length === 0 ? (
											<p className='rounded-lg border border-gray-200 p-3 text-sm text-gray-500'>
												Попереджень немає.
											</p>
										) : (
											<>
												<p className='text-sm text-gray-500'>
													Позицій із попередженнями: {summary.warned_items} з{' '}
													{summary.item_count}.
												</p>
												<ul className='space-y-2'>
													{summary.warnings.map(w => {
														const detail = warningDetail(w)
														return (
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
																			{detail && (
																				<>
																					{' — '}
																					{detail}
																				</>
																			)}
																		</p>
																		{w.skus.length > 0 && (
																			<p className='mt-1 font-mono text-xs text-amber-800'>
																				{w.skus.join(', ')}
																				{w.item_count > w.skus.length
																					? ` … ще ${w.item_count - w.skus.length}`
																					: ''}
																			</p>
																		)}
																	</div>
																</div>
																<span className='shrink-0 text-sm font-medium'>
																	{warningCountLabel(w.count, w.unit)}
																</span>
															</li>
														)
													})}
												</ul>
											</>
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

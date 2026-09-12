'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { httpService } from '@/common/services/http.service'
import { API_BASE_URL, API_URLS } from '@/common/constants/api-routes.constants'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'

type ApiToken = {
	id: string
	name: string
	prefix: string
	created_at: string
	revoked_at: string | null
	last_used_at: string | null
}
const queryKey = ['admin-api-tokens']
const date = (value: string | null) =>
	value ? new Date(value).toLocaleString('uk-UA') : 'Ще не використовувався'
export default function ApiTokensPage() {
	const client = useQueryClient()
	const [name, setName] = useState('')
	const [secret, setSecret] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [confirmId, setConfirmId] = useState<string | null>(null)
	const tokens = useQuery({
		queryKey,
		queryFn: () => httpService.get<ApiToken[], never>(API_URLS.PARTNER_TOKENS)
	})
	async function create(event: React.FormEvent) {
		event.preventDefault()
		if (busy || !name.trim() || secret) return
		setBusy(true)
		try {
			const result = await httpService.post<ApiToken & { token: string }, { name: string }>(
				API_URLS.PARTNER_TOKENS,
				{ name: name.trim() }
			)
			setSecret(result.token)
			setName('')
			void client.invalidateQueries({ queryKey })
		} catch {
			/* HTTP service displays the error. */
		} finally {
			setBusy(false)
		}
	}
	async function revoke(id: string) {
		setBusy(true)
		try {
			await httpService.delete(API_URLS.PARTNER_TOKENS + '/' + id)
			setConfirmId(null)
			toast.success('Токен відкликано')
			void client.invalidateQueries({ queryKey })
		} catch {
			/* HTTP service displays the error. */
		} finally {
			setBusy(false)
		}
	}
	return (
		<main className='mx-auto max-w-6xl space-y-6 p-4 md:p-8'>
			<div>
				<h1 className='text-2xl font-semibold'>API-токени</h1>
				<p className='mt-2 text-sm text-gray-600'>
					Доступ партнерів до наявності товарів за артикулом. Створіть окремий токен для
					кожної інтеграції.
				</p>
				<a
					className='mt-2 inline-block text-sm text-blue-700 underline'
					href={API_BASE_URL.replace(/\/$/, '') + API_URLS.PARTNER_DOCS}
					target='_blank'
					rel='noreferrer'
				>
					Публічна документація API (Swagger)
				</a>
			</div>
			<form onSubmit={create} className='space-y-3 rounded-lg border bg-white p-5'>
				<label htmlFor='partner-name' className='block text-sm font-medium'>
					Назва партнера або інтеграції
				</label>
				<div className='flex flex-col gap-3 sm:flex-row'>
					<Input
						id='partner-name'
						value={name}
						onChange={e => setName(e.target.value)}
						maxLength={100}
						required
						placeholder='Наприклад, Партнер — CRM'
						disabled={busy || !!secret}
					/>
					<Button type='submit' disabled={busy || !name.trim() || !!secret}>
						{busy ? 'Зачекайте…' : 'Створити токен'}
					</Button>
				</div>
			</form>
			{secret && (
				<section
					role='status'
					className='space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-5'
				>
					<h2 className='font-semibold'>
						Збережіть токен — він показується лише один раз
					</h2>
					<p className='text-sm'>
						Передайте його партнеру захищеним каналом. Після закриття відновити токен
						неможливо.
					</p>
					<code className='block rounded bg-white p-3 text-sm break-all'>{secret}</code>
					<div className='flex flex-wrap gap-3'>
						<Button
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(secret)
									toast.success('Токен скопійовано')
								} catch {
									toast.error(
										'Не вдалося скопіювати. Виділіть токен і скопіюйте вручну.'
									)
								}
							}}
						>
							Скопіювати
						</Button>
						<Button variant='outline' onClick={() => setSecret(null)}>
							Я зберіг токен — закрити
						</Button>
					</div>
				</section>
			)}
			{tokens.isPending ? (
				<p>Завантаження…</p>
			) : tokens.isError ? (
				<div role='alert'>
					Не вдалося завантажити токени.{' '}
					<Button variant='outline' onClick={() => tokens.refetch()}>
						Спробувати ще раз
					</Button>
				</div>
			) : !tokens.data.length ? (
				<p className='text-gray-600'>API-токенів ще немає.</p>
			) : (
				<div className='overflow-x-auto rounded-lg border bg-white'>
					<table className='w-full text-left text-sm'>
						<thead className='bg-gray-50'>
							<tr>
								{[
									'Назва',
									'Токен',
									'Створено',
									'Останнє використання',
									'Статус / дії'
								].map(label => (
									<th key={label} className='p-4 font-medium'>
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{tokens.data.map(token => (
								<tr key={token.id} className='border-t'>
									<td className='p-4'>{token.name}</td>
									<td className='p-4 font-mono'>{token.prefix}…</td>
									<td className='p-4'>{date(token.created_at)}</td>
									<td className='p-4'>{date(token.last_used_at)}</td>
									<td className='p-4'>
										{token.revoked_at ? (
											<span className='text-gray-500'>
												Відкликано {date(token.revoked_at)}
											</span>
										) : confirmId === token.id ? (
											<div className='space-y-2'>
												<p>Інтеграція втратить доступ. Відкликати?</p>
												<Button
													disabled={busy}
													onClick={() => revoke(token.id)}
												>
													Так, відкликати
												</Button>{' '}
												<Button
													variant='outline'
													disabled={busy}
													onClick={() => setConfirmId(null)}
												>
													Скасувати
												</Button>
											</div>
										) : (
											<Button
												variant='outline'
												disabled={busy}
												onClick={() => setConfirmId(token.id)}
											>
												Відкликати
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</main>
	)
}

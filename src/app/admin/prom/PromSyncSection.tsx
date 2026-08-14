'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/common/components/ui/card'
import { getPromSyncStreamUrl } from './prom.constants'
import { promSyncEventSchema } from './prom.schema'

export const PromSyncSection = () => {
	const esRef = useRef<EventSource | null>(null)
	const streamFinishedRef = useRef(false)

	const [isSyncing, setIsSyncing] = useState(false)
	const [total, setTotal] = useState(0)
	const [processed, setProcessed] = useState(0)
	const [updated, setUpdated] = useState(0)
	const [pricesUpdated, setPricesUpdated] = useState(0)
	const [skipped, setSkipped] = useState(0)
	const [errors, setErrors] = useState(0)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const closeEventSource = useCallback(() => {
		esRef.current?.close()
		esRef.current = null
	}, [])

	useEffect(() => () => closeEventSource(), [closeEventSource])

	const startSync = useCallback(() => {
		closeEventSource()
		streamFinishedRef.current = false

		setSuccessMessage(null)
		setErrorMessage(null)
		setTotal(0)
		setProcessed(0)
		setUpdated(0)
		setPricesUpdated(0)
		setSkipped(0)
		setErrors(0)
		setIsSyncing(true)

		const url = getPromSyncStreamUrl()
		const es = new EventSource(url, { withCredentials: true })
		esRef.current = es

		const failWith = (msg: string) => {
			streamFinishedRef.current = true
			closeEventSource()
			setIsSyncing(false)
			setErrorMessage(msg)
			toast.error(msg)
		}

		es.onmessage = event => {
			let parsed: unknown
			try {
				parsed = JSON.parse(event.data) as unknown
			} catch {
				failWith('Некоректна відповідь сервера')
				return
			}

			const result = promSyncEventSchema.safeParse(parsed)
			if (!result.success) {
				failWith('Некоректна відповідь сервера')
				return
			}

			const data = result.data

			if (data.type === 'progress') {
				setTotal(data.total)
				setProcessed(data.processed)
				setUpdated(data.updated)
				setPricesUpdated(data.pricesUpdated)
				setSkipped(data.skipped)
				setErrors(data.errors)
				return
			}

			if (data.type === 'done') {
				streamFinishedRef.current = true
				closeEventSource()
				setIsSyncing(false)
				setTotal(data.total)
				setProcessed(data.processed)
				setUpdated(data.updated)
				setPricesUpdated(data.pricesUpdated)
				setSkipped(data.skipped)
				setErrors(data.errors)
				const msg = `Готово: оновлено ${data.updated}, з них цін ${data.pricesUpdated}, пропущено ${data.skipped}, помилок ${data.errors} (усього ${data.total})`
				setSuccessMessage(msg)
				toast.success(msg)
				return
			}

			if (data.type === 'error') {
				failWith(data.message)
			}
		}

		es.onerror = () => {
			if (streamFinishedRef.current) {
				return
			}
			failWith("З'єднання перервано")
		}
	}, [closeEventSource])

	return (
		<Card className='max-w-xl'>
			<CardHeader>
				<CardTitle className='text-lg'>Наявність і ціни (Prom)</CardTitle>
				<CardDescription>
					Синхронізація товарів із Prom за їхнім Prom ID. Для кожного варіанта з prom_id
					оновлюється залишок, а для тих, що є в наявності — ще й ціна: ціна Prom зі
					знижкою плюс фіксована націнка за діапазоном. Товари без наявності зберігають
					поточну ціну. Прогрес оновлюється в реальному часі; операція може зайняти кілька
					хвилин.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-4'>
				<Button
					type='button'
					disabled={isSyncing}
					onClick={startSync}
					className='min-w-[220px]'
				>
					Синхронізувати наявність і ціни
				</Button>

				{isSyncing && (
					<div
						className='border-input rounded-md border bg-gray-50/80 px-4 py-3 text-sm'
						aria-live='polite'
					>
						<p className='mb-3 flex items-center gap-2 font-medium text-gray-800'>
							<Loader2
								className='text-primary h-4 w-4 shrink-0 animate-spin'
								aria-hidden
							/>
							Синхронізація… {processed}/{total}
						</p>
						<div className='space-y-1 text-gray-700'>
							<p>Оновлено: {updated}</p>
							<p>Змінено цін: {pricesUpdated}</p>
							<p>Пропущено: {skipped}</p>
							<p>Помилок: {errors}</p>
						</div>
					</div>
				)}

				{successMessage && !isSyncing && (
					<p className='text-sm font-medium text-green-700' role='status'>
						{successMessage}
					</p>
				)}

				{errorMessage && !isSyncing && (
					<p className='text-sm font-medium text-red-700' role='alert'>
						{errorMessage}
					</p>
				)}
			</CardContent>
		</Card>
	)
}

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
import { getNovaPostSyncStreamUrl } from './nova-post.constants'
import { syncProgressEventSchema } from './nova-post.schema'

export const NovaPostSyncSection = () => {
	const esRef = useRef<EventSource | null>(null)
	const streamFinishedRef = useRef(false)

	const [isSyncing, setIsSyncing] = useState(false)
	const [citiesSynced, setCitiesSynced] = useState(0)
	const [warehousesSynced, setWarehousesSynced] = useState(0)
	const [activeEntity, setActiveEntity] = useState<'cities' | 'warehouses' | null>(null)
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
		setCitiesSynced(0)
		setWarehousesSynced(0)
		setActiveEntity('cities')
		setIsSyncing(true)

		const url = getNovaPostSyncStreamUrl()
		const es = new EventSource(url, { withCredentials: true })
		esRef.current = es

		es.onmessage = event => {
			let parsed: unknown
			try {
				parsed = JSON.parse(event.data) as unknown
			} catch {
				streamFinishedRef.current = true
				closeEventSource()
				setIsSyncing(false)
				setActiveEntity(null)
				const msg = 'Некоректна відповідь сервера'
				setErrorMessage(msg)
				toast.error(msg)
				return
			}

			const result = syncProgressEventSchema.safeParse(parsed)
			if (!result.success) {
				streamFinishedRef.current = true
				closeEventSource()
				setIsSyncing(false)
				setActiveEntity(null)
				const msg = 'Некоректна відповідь сервера'
				setErrorMessage(msg)
				toast.error(msg)
				return
			}

			const data = result.data

			if (data.type === 'progress') {
				if (data.entity === 'cities') {
					setCitiesSynced(data.synced)
					setActiveEntity('cities')
				} else {
					setWarehousesSynced(data.synced)
					setActiveEntity('warehouses')
				}
				return
			}

			if (data.type === 'done') {
				streamFinishedRef.current = true
				closeEventSource()
				setIsSyncing(false)
				setActiveEntity(null)
				const msg = `Синхронізовано: ${data.cities} міст, ${data.warehouses} відділень`
				setSuccessMessage(msg)
				toast.success(msg)
				return
			}

			if (data.type === 'error') {
				streamFinishedRef.current = true
				closeEventSource()
				setIsSyncing(false)
				setActiveEntity(null)
				setErrorMessage(data.message)
				toast.error(data.message)
			}
		}

		es.onerror = () => {
			if (streamFinishedRef.current) {
				return
			}
			streamFinishedRef.current = true
			closeEventSource()
			setIsSyncing(false)
			setActiveEntity(null)
			const msg = "З'єднання перервано"
			setErrorMessage(msg)
			toast.error(msg)
		}
	}, [closeEventSource])

	return (
		<Card className='max-w-xl'>
			<CardHeader>
				<CardTitle className='text-lg'>Нова Пошта</CardTitle>
				<CardDescription>
					Повна синхронізація міст та відділень Нової Пошти в базу даних. Прогрес
					оновлюється в реальному часі; операція може зайняти до кількох хвилин.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-4'>
				<Button
					type='button'
					disabled={isSyncing}
					onClick={startSync}
					className='min-w-[220px]'
				>
					Синхронізувати Нову Пошту
				</Button>

				{isSyncing && (
					<div
						className='border-input rounded-md border bg-gray-50/80 px-4 py-3 text-sm'
						aria-live='polite'
					>
						<p className='mb-3 font-medium text-gray-800'>Синхронізація…</p>
						<div className='space-y-3'>
							<ProgressRow
								label='Міста'
								count={citiesSynced}
								isActive={activeEntity === 'cities'}
							/>
							<ProgressRow
								label='Відділення'
								count={warehousesSynced}
								isActive={activeEntity === 'warehouses'}
							/>
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

function ProgressRow({
	label,
	count,
	isActive
}: {
	label: string
	count: number
	isActive: boolean
}) {
	return (
		<div className='flex items-center gap-2 text-gray-900'>
			{isActive ? (
				<Loader2 className='text-primary h-4 w-4 shrink-0 animate-spin' aria-hidden />
			) : (
				<span className='inline-block w-4 shrink-0' aria-hidden />
			)}
			<span>
				{label}: синхронізовано: {count}
				{isActive && (
					<span className='text-muted-foreground ml-1.5 text-xs'>
						(зараз обробляється)
					</span>
				)}
			</span>
		</div>
	)
}

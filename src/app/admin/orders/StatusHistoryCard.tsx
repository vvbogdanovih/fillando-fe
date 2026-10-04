import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, STATUS_ACTOR_LABELS } from './orders.constants'
import type { StatusHistoryEntry } from './orders.schema'
import { formatDate } from './orders.utils'

function statusLabel(field: StatusHistoryEntry['field'], value: string | null | undefined) {
	if (!value) return null
	const labels: Record<string, string> =
		field === 'order_status' ? ORDER_STATUS_LABELS : PAYMENT_STATUS_LABELS
	return labels[value] ?? value
}

/** Who changed what and when (TD-0011 `status_history`), newest first. */
export function StatusHistoryCard({ history }: { history: StatusHistoryEntry[] }) {
	if (history.length === 0) return null
	const entries = [...history].reverse()

	return (
		<Card>
			<CardHeader>
				<CardTitle>Історія статусів</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className='space-y-3 text-sm'>
					{entries.map((entry, index) => {
						const from = statusLabel(entry.field, entry.from)
						const to = statusLabel(entry.field, entry.to)
						return (
							<li
								key={`${entry.at}-${entry.field}-${index}`}
								className='flex flex-col gap-0.5 border-l-2 border-gray-200 pl-3 sm:flex-row sm:gap-4'
							>
								<span className='text-muted-foreground shrink-0 tabular-nums sm:w-40'>
									{formatDate(entry.at)}
								</span>
								<span className='min-w-0 flex-1'>
									<span className='text-muted-foreground'>
										{entry.field === 'order_status'
											? 'Замовлення: '
											: 'Оплата: '}
									</span>
									{from ? `${from} → ${to}` : to}
									{entry.note && (
										<span className='text-muted-foreground block text-xs break-words'>
											{entry.note}
										</span>
									)}
								</span>
								<span className='text-muted-foreground shrink-0 text-xs sm:text-sm'>
									{STATUS_ACTOR_LABELS[entry.actor]}
								</span>
							</li>
						)
					})}
				</ol>
			</CardContent>
		</Card>
	)
}

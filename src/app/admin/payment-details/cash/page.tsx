import { Banknote, Info } from 'lucide-react'

export default function CashPaymentDetailsPage() {
	return (
		<div className='flex h-full min-h-0 flex-col bg-white'>
			<div className='flex shrink-0 items-center border-b border-gray-200 px-4 py-4 sm:px-6'>
				<h2 className='text-sm font-semibold text-gray-900'>Готівка</h2>
			</div>

			<div className='flex flex-1 flex-col items-center justify-center px-6 py-16'>
				<div className='w-full max-w-sm'>
					<div className='mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100'>
						<Banknote className='h-7 w-7 text-gray-500' />
					</div>

					<h3 className='mb-2 text-base font-semibold text-gray-900'>Готівка</h3>

					<div className='flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3'>
						<Info className='mt-0.5 h-4 w-4 shrink-0 text-blue-500' />
						<p className='text-sm text-blue-700'>
							Доступно тільки при{' '}
							<span className='font-medium'>«Спосіб доставки — самовивіз»</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}

/** Blocks in the shape of the dashboard, for the first load and the Suspense boundary. */
export const DashboardSkeleton = () => (
	<div className='space-y-4' aria-busy='true' aria-label='Завантаження аналітики'>
		<div className='h-9 w-full max-w-2xl animate-pulse rounded-md bg-gray-100' />
		<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
			{Array.from({ length: 5 }).map((_, index) => (
				<div key={index} className='h-24 animate-pulse rounded-xl bg-gray-100' />
			))}
		</div>
		<div className='h-[480px] animate-pulse rounded-lg bg-gray-100' />
		<div className='h-72 animate-pulse rounded-lg bg-gray-100' />
		<div className='grid gap-4 md:grid-cols-2'>
			{Array.from({ length: 4 }).map((_, index) => (
				<div key={index} className='h-40 animate-pulse rounded-lg bg-gray-100' />
			))}
		</div>
	</div>
)

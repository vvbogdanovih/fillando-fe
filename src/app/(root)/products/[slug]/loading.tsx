export default function ProductLoading() {
    return (
        <div className='container mx-auto max-w-7xl px-4 py-8'>
            <div className='mb-6 h-4 w-48 animate-pulse rounded bg-muted' />
            <div className='flex flex-col gap-8 lg:flex-row'>
                <div className='aspect-square w-full animate-pulse rounded-xl bg-muted lg:w-1/2' />
                <div className='flex flex-col gap-5 lg:w-1/2'>
                    <div className='h-8 w-3/4 animate-pulse rounded bg-muted' />
                    <div className='h-6 w-24 animate-pulse rounded bg-muted' />
                    <div className='h-10 w-32 animate-pulse rounded bg-muted' />
                    <div className='flex gap-3'>
                        <div className='h-9 w-28 animate-pulse rounded-lg bg-muted' />
                        <div className='h-9 flex-1 animate-pulse rounded-lg bg-muted' />
                    </div>
                </div>
            </div>
        </div>
    )
}

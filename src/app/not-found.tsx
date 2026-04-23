import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Сторінку не знайдено' }

export default function NotFound() {
    return (
        <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center'>
            <h1 className='text-4xl font-bold'>404</h1>
            <p className='text-muted-foreground'>Сторінку не знайдено</p>
            <Link href='/' className='text-primary hover:underline'>
                Повернутись на головну
            </Link>
        </div>
    )
}

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { UI_URLS } from '@/common/constants'


const FILAMENT_IMAGE =
	'https://fillando.s3.eu-north-1.amazonaws.com/categories/69b7c553ff27ba94157052db/bb2bfe7d-cd2d-45fd-8534-0cd888757962.png'

export const Home = () => {
	return (
		<div className='container mx-auto max-w-7xl px-4 py-16'>
			{/* Hero */}
			<section className='mb-16 text-center'>
				<h1 className='mb-4 text-5xl font-bold tracking-tight'>
					Все для <span className='gradient-text'>3D-друку</span>
				</h1>
				<p className='text-muted-foreground mx-auto max-w-xl text-lg'>
					Якісні витратні матеріали та аксесуари для вашого 3D-принтера
				</p>
			</section>

			{/* Catalog */}
			<section>
				<p className='text-muted-foreground mb-6 text-xs font-semibold tracking-widest uppercase'>
					Каталог
				</p>
				<Link href={UI_URLS.CATALOG.FILAMENT} className='group block'>
					<div className='card-hover relative aspect-16/7 cursor-pointer overflow-hidden rounded-2xl'>
						<Image
							src={FILAMENT_IMAGE}
							alt='Філамент для 3D-друку'
							fill
							className='object-cover transition-transform duration-500 group-hover:scale-105'
							priority
						/>
						<div className='absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent' />
						<div className='absolute right-0 bottom-0 left-0 flex items-end justify-between p-8'>
							<div>
								<span className='text-primary text-xs font-semibold tracking-widest uppercase'>
									Витратні матеріали
								</span>
								<h3 className='mt-1 text-4xl font-bold text-white'>Філамент</h3>
								<p className='mt-2 text-sm text-white/60'>
									PLA · PETG · ABS · TPU · Nylon
								</p>
							</div>
							<div className='bg-primary text-primary-foreground glow-primary rounded-full p-3 transition-transform duration-300 group-hover:scale-110'>
								<ArrowRight className='h-6 w-6' />
							</div>
						</div>
					</div>
				</Link>
			</section>
		</div>
	)
}

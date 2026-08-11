'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Truck, ShieldCheck, Headset } from 'lucide-react'
import { UI_URLS } from '@/common/constants'
import { Button } from '@/common/components/ui/button'
import { MagneticButton } from '@/common/components/motion'

const TRUST = [
	{ icon: Truck, label: 'Швидка доставка' },
	{ icon: ShieldCheck, label: 'Гарантія якості' },
	{ icon: Headset, label: 'Підтримка 7 днів на тиждень' }
]

export function Hero({ imageUrl }: { imageUrl: string }) {
	return (
		<section className='py-8 md:py-12'>
			<div className='relative overflow-hidden rounded-3xl'>
				<Image
					src={imageUrl}
					alt='Філамент для 3D-друку'
					fill
					priority
					fetchPriority='high'
					sizes='100vw'
					className='object-cover'
				/>
				<div className='absolute inset-0 bg-linear-to-r from-black/85 via-black/55 to-black/10' />
				<div className='relative flex min-h-[500px] flex-col justify-center p-8 md:min-h-[580px] md:p-16'>
					<div className='max-w-xl'>
						<h1 className='text-5xl font-bold tracking-tight text-white md:text-6xl'>
							Все для <span className='gradient-text'>3D-друку</span>
						</h1>
						<p className='mt-4 max-w-lg text-lg text-white/80'>
							Якісні витратні матеріали та аксесуари для вашого 3D-принтера.
							Філамент PLA, PETG, ABS, TPU та Nylon.
						</p>
						<div className='mt-8 flex flex-wrap items-center gap-3'>
							<MagneticButton>
								<Button asChild size='lg'>
									<Link href={UI_URLS.CATALOG.FILAMENT}>
										Перейти до каталогу
										<ArrowRight className='size-4' />
									</Link>
								</Button>
							</MagneticButton>
							<Button
								asChild
								size='lg'
								variant='outline'
								className='border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white'
							>
								<Link href={UI_URLS.WHOLESALE}>Оптовим клієнтам</Link>
							</Button>
						</div>
						<div className='mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70'>
							{TRUST.map(({ icon: Icon, label }) => (
								<span key={label} className='flex items-center gap-2'>
									<Icon className='text-primary size-4' />
									{label}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

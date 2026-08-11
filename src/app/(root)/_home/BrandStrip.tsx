import { MANUFACTURERS } from '@/common/constants'
import { ScrollReveal } from '@/common/components/motion'

export function BrandStrip() {
	return (
		<section className='py-8 md:py-12'>
			<ScrollReveal className='flex flex-wrap items-center justify-center gap-8 md:gap-14'>
				{MANUFACTURERS.map(brand => (
					// Below the fold and starts at opacity 0 inside ScrollReveal, so keep it
					// out of React's automatic eager-image preload.
					// eslint-disable-next-line @next/next/no-img-element
					<img
						key={brand.name}
						src={brand.logo}
						alt={brand.name}
						width={brand.width}
						height={brand.height}
						loading='lazy'
						decoding='async'
						className='h-8 w-auto max-w-[150px] object-contain opacity-60 mix-blend-multiply grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 md:h-10'
					/>
				))}
			</ScrollReveal>
		</section>
	)
}

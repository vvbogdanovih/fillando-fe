import Link from 'next/link'
import type { StorefrontContent } from '@/app/admin/storefront/storefront.schema'
import { CardAurora } from './CardAurora'

/**
 * The band between the home page's strips (TD-0015), from «Вітрина»; none when it is `null`. Dark,
 * in the manner of the card beside the banner (owner, 2026-11-14): the pale wash it was looked
 * faded under the first row. The colour and the glow are two classes — one `bg-[…]` holding both
 * is an invalid declaration, and the white text lands on the light page. Over that gradient lives
 * the cards' «Аврора» (`CardAurora`); the gradient is what shows without it.
 */
export function PromoBand({ band }: { band: NonNullable<StorefrontContent['band']> }) {
	return (
		<section
			aria-label={band.title}
			className='relative isolate my-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden rounded-[20px] bg-[#0f172a] bg-[image:radial-gradient(90%_160%_at_100%_0,rgba(24,144,219,.5),transparent_62%)] px-5 py-5 text-[#e8f1f6] md:px-8 md:py-6'
		>
			<CardAurora />
			<div>
				<h2 className='font-display text-lg leading-tight font-semibold text-white'>
					{band.title}
				</h2>
				{band.text && <p className='mt-1.5 text-sm text-[#b9c7d6]'>{band.text}</p>}
			</div>
			<Link
				href={band.button_href}
				className='bg-primary text-primary-foreground inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition hover:brightness-105 sm:w-auto'
			>
				{band.button_label}
			</Link>
		</section>
	)
}

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { StorefrontContent } from '@/app/admin/storefront/storefront.schema'
import { AuroraBackground } from './AuroraBackground'

/**
 * The home page's banner (TD-0015): copy from «Вітрина», its title the page's H1 with `accent`
 * highlighted, over the «Аврора» background. The text is server HTML on a dark CSS gradient of the
 * same colours, so it reads before — and without — the canvas.
 */
export function PromoBanner({ banner }: { banner: StorefrontContent['banner'] }) {
	const at = banner.accent ? banner.title.indexOf(banner.accent) : -1
	return (
		<section
			aria-label='Банер'
			className='relative isolate flex min-h-[280px] items-center overflow-hidden rounded-2xl bg-[#0b1220] bg-[image:radial-gradient(120%_90%_at_85%_10%,rgba(27,184,148,.45),transparent_55%),radial-gradient(80%_70%_at_70%_100%,rgba(24,144,219,.4),transparent_60%)] text-[#e8f1f6] md:min-h-[320px] lg:min-h-[400px]'
		>
			<AuroraBackground />
			<div className='relative max-w-xl px-6 py-8 md:px-9'>
				{banner.eyebrow && (
					<p className='mb-3 font-mono text-[11px] tracking-[0.14em] uppercase opacity-75'>
						{banner.eyebrow}
					</p>
				)}
				<h1 className='font-display text-2xl leading-tight font-bold tracking-tight text-balance md:text-[34px]'>
					{at < 0 ? (
						banner.title
					) : (
						<>
							{banner.title.slice(0, at)}
							<span className='bg-linear-to-r from-[#19e6b3] to-[#1890db] bg-clip-text text-transparent'>
								{banner.accent}
							</span>
							{banner.title.slice(at + banner.accent.length)}
						</>
					)}
				</h1>
				{banner.text && <p className='mt-3 max-w-[42ch] opacity-85'>{banner.text}</p>}
				<Link
					href={banner.button_href}
					className='bg-primary text-primary-foreground mt-5 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:brightness-105'
				>
					{banner.button_label}
					<ArrowRight className='size-4' aria-hidden />
				</Link>
			</div>
		</section>
	)
}

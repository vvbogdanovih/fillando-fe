import Link from 'next/link'
import type { StorefrontContent } from '@/app/admin/storefront/storefront.schema'
import { WholesaleFormButton } from '@/common/components/wholesale/WholesaleFormButton'

const button =
	'bg-primary text-primary-foreground inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:brightness-105'

/** The card beside the banner (TD-0015): the wholesale inquiry form, or a link — from «Вітрина». */
export function SidePromo({ promo }: { promo: StorefrontContent['side_promo'] }) {
	return (
		<aside
			aria-label={promo.title}
			className='grid content-between gap-4 rounded-2xl bg-[#0f172a] bg-[image:radial-gradient(120%_80%_at_100%_0,rgba(24,144,219,.55),transparent_60%)] p-6 text-[#e8f1f6]'
		>
			<div>
				<h2 className='font-display text-xl leading-tight font-semibold'>{promo.title}</h2>
				{promo.text && <p className='mt-2 text-sm text-[#b9c7d6]'>{promo.text}</p>}
			</div>
			{promo.action === 'link' && promo.button_href ? (
				<Link href={promo.button_href} className={button}>
					{promo.button_label}
				</Link>
			) : (
				<WholesaleFormButton className={button}>{promo.button_label}</WholesaleFormButton>
			)}
		</aside>
	)
}

import { ReactNode } from 'react'
import { Header } from '@/common/components/Header'
import { Footer } from '@/common/components/Footer'
import { JsonLd } from '@/common/components/JsonLd'
import { CookieConsentBanner } from '@/common/components/CookieConsentBanner'
// Deep path, not the `motion` barrel — see the note in SmoothScrollProvider.
import { SmoothScrollProvider } from '@/common/components/motion/SmoothScrollProvider'
import { SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'

const orgSchema = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: SITE_NAME,
	url: SITE_URL,
	logo: `${SITE_URL}/logo.png`
}

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<SmoothScrollProvider>
			<div className='flex min-h-screen w-full flex-col'>
				<JsonLd data={orgSchema} />
				<Header />
				<div className='flex-1'>{children}</div>
				<Footer />
				{/* Storefront only — admin and auth are out of scope for the ads tag. */}
				<CookieConsentBanner />
			</div>
		</SmoothScrollProvider>
	)
}

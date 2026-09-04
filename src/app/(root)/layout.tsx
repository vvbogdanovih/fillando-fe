import { ReactNode } from 'react'
import { Header } from '@/common/components/Header'
import { Footer } from '@/common/components/Footer'
import { JsonLd } from '@/common/components/JsonLd'
import { CookieConsentBanner } from '@/common/components/CookieConsentBanner'
// Deep path, not the `motion` barrel — see the note in SmoothScrollProvider.
import { SmoothScrollProvider } from '@/common/components/motion/SmoothScrollProvider'
import { SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'
import { CONTACTS } from '@/common/constants/contacts.constants'
import { STATIC_NAV_LINKS, type NavLink } from '@/common/constants/navigation.constants'
import { getCategoryNavLinks } from '@/common/utils/navigation.utils'

/**
 * `logo` pointed at `/logo.png`, which has never existed in `public/` — Google fetched a 404
 * and the organisation had no logo in the knowledge panel. `Fillando-logo.png` is the real
 * file (2199×518, comfortably over the 112px minimum).
 *
 * The contact, address and profile fields come from the same constants the footer and the
 * offer page render, so the markup cannot drift from what a visitor reads.
 */
const orgSchema = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: SITE_NAME,
	url: SITE_URL,
	logo: `${SITE_URL}/Fillando-logo.png`,
	email: CONTACTS.EMAIL,
	telephone: CONTACTS.PHONE,
	address: {
		'@type': 'PostalAddress',
		streetAddress: 'вул. Широка, 1',
		addressLocality: 'Львів',
		postalCode: '79000',
		addressCountry: 'UA'
	},
	contactPoint: {
		'@type': 'ContactPoint',
		contactType: 'customer service',
		telephone: CONTACTS.PHONE,
		email: CONTACTS.EMAIL,
		areaServed: 'UA',
		availableLanguage: ['uk']
	},
	sameAs: [CONTACTS.TELEGRAM_URL]
}

export default async function Layout({ children }: { children: ReactNode }) {
	// Fetched here, in the one server component every storefront page passes through, so the
	// links are in the HTML a crawler receives rather than appearing after hydration.
	const categories = await getCategoryNavLinks()
	const navLinks: NavLink[] = [...categories, ...STATIC_NAV_LINKS]

	return (
		<SmoothScrollProvider>
			<div className='flex min-h-screen w-full flex-col'>
				<JsonLd data={orgSchema} />
				<Header navLinks={navLinks} />
				<div className='flex-1'>{children}</div>
				<Footer categories={[...categories]} />
				{/* Storefront only — admin and auth are out of scope for the ads tag. */}
				<CookieConsentBanner />
			</div>
		</SmoothScrollProvider>
	)
}

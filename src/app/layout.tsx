import type { Metadata } from 'next'
import { Geist_Mono, Onest, Unbounded } from 'next/font/google'
import './globals.css'
import { Providers } from './provider'
import { Analytics } from '@/common/components/Analytics'
import { consentBootstrapScript } from '@/common/lib/consent-mode'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'

// The storefront's faces (TD-0015, owner 2026-11-09): Onest for text, Unbounded for the display
// headings (`font-display`). The admin keeps Inter (`admin/layout.tsx`).
const onest = Onest({
	variable: '--font-onest',
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700']
})

const unbounded = Unbounded({
	variable: '--font-unbounded',
	subsets: ['latin', 'cyrillic'],
	weight: ['500', '700']
})

// Not preloaded: the storefront sets it only in the home banner's eyebrow, the price sheet's articles
// and `code` in descriptions (the admin's tables use it too), and a preload on every page competes with
// the CSS for the first bytes (Lighthouse, 2026-11-11). It still loads where it is used, `display: swap`.
const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
	preload: false
})

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: { absolute: SITE_NAME, template: `%s | ${SITE_NAME}` },
	description: SITE_DESCRIPTION,
	openGraph: {
		siteName: SITE_NAME,
		locale: 'uk_UA',
		type: 'website'
	},
	twitter: { card: 'summary_large_image' },
	// Next omits the tag while the value is undefined, so this is inert until the owner
	// completes Search Console verification and sets the build arg (TD-0006 §5.6).
	verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
}

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='uk'>
			<link rel='preconnect' href='https://fillando.s3.eu-north-1.amazonaws.com' />
			<body
				className={`${onest.variable} ${unbounded.variable} ${geistMono.variable} flex flex-col items-center antialiased`}
				suppressHydrationWarning={true}
			>
				{/* Consent Mode v2: the denied default and the tag's config, queued before anything
				    else can push an event. Inline and first in <body> on purpose. */}
				<script dangerouslySetInnerHTML={{ __html: consentBootstrapScript() }} />
				<Providers>
					<main className='flex w-full items-center justify-center'>{children}</main>
					{/* Loads gtag.js and reports the visitor's cookie choice to it. */}
					<Analytics />
				</Providers>
			</body>
		</html>
	)
}

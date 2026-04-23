import type { Metadata } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './provider'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'

const inter = Inter({
	variable: '--font-inter',
	subsets: ['latin', 'cyrillic'],
	weight: ['300', '400', '500', '600', '700', '800']
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin']
})

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: { absolute: SITE_NAME, template: `%s | ${SITE_NAME}` },
	description: SITE_DESCRIPTION,
	openGraph: {
		siteName: SITE_NAME,
		locale: 'uk_UA',
		type: 'website',
	},
	twitter: { card: 'summary_large_image' },
}

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='uk'>
			<body
				className={`${inter.variable} ${geistMono.variable} flex flex-col items-center antialiased`}
				suppressHydrationWarning={true}
			>
				<Providers>
					<main className='flex w-full items-center justify-center'>{children}</main>
				</Providers>
			</body>
		</html>
	)
}

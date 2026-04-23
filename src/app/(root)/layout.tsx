import { ReactNode } from 'react'
import { Header } from '@/common/components/Header'
import { Footer } from '@/common/components/Footer'
import { JsonLd } from '@/common/components/JsonLd'
import { SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'

const orgSchema = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: SITE_NAME,
	url: SITE_URL,
	logo: `${SITE_URL}/logo.png`,
}

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className='flex min-h-screen w-full flex-col'>
			<JsonLd data={orgSchema} />
			<Header />
			<div className='flex-1'>{children}</div>
			<Footer />
		</div>
	)
}

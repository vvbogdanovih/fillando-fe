import type { Metadata } from 'next'
import { Home } from './Home'
import { JsonLd } from '@/common/components/JsonLd'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'
import { UI_URLS } from '@/common/constants/ui-routes.constants'

export const metadata: Metadata = {
	title: 'Fillando — філамент та витратні матеріали для 3D-друку',
	description: SITE_DESCRIPTION,
	alternates: { canonical: SITE_URL }
}

/**
 * `WebSite` with a `SearchAction` is what lets Google offer a search box for the site directly
 * in the results, and it is only ever read from the home page. The target must be the real
 * search URL with the query token in the place the site expects it.
 */
const websiteSchema = {
	'@context': 'https://schema.org',
	'@type': 'WebSite',
	name: SITE_NAME,
	url: SITE_URL,
	inLanguage: 'uk-UA',
	potentialAction: {
		'@type': 'SearchAction',
		target: {
			'@type': 'EntryPoint',
			urlTemplate: `${SITE_URL}${UI_URLS.SEARCH}?q={search_term_string}`
		},
		'query-input': 'required name=search_term_string'
	}
}

export const HomePage = () => {
	return (
		<>
			<JsonLd data={websiteSchema} />
			<Home />
		</>
	)
}

export default HomePage

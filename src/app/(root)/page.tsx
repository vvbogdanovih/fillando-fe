import type { Metadata } from 'next'
import { Home } from './Home'
import { SITE_DESCRIPTION, SITE_URL } from '@/common/constants/seo.constants'

export const metadata: Metadata = {
	title: 'Fillando — філамент та витратні матеріали для 3D-друку',
	description: SITE_DESCRIPTION,
	alternates: { canonical: SITE_URL },
}

export const HomePage = () => {
	return <Home />
}

export default HomePage

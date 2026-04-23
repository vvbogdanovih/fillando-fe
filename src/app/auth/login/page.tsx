import type { Metadata } from 'next'
import { Login } from './Login'
import { NO_INDEX } from '@/common/constants/seo.constants'

export const metadata: Metadata = { title: 'Вхід', ...NO_INDEX }

export const LoginPage = () => {
	return <Login />
}

export default LoginPage

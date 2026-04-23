import type { Metadata } from 'next'
import { Register } from './Register'
import { NO_INDEX } from '@/common/constants/seo.constants'

export const metadata: Metadata = { title: 'Реєстрація', ...NO_INDEX }

export const RegisterPage = () => {
	return <Register />
}

export default RegisterPage

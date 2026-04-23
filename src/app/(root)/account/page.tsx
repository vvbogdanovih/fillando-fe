import { redirect } from 'next/navigation'
import { UI_URLS } from '@/common/constants'

export default function AccountPage() {
	redirect(UI_URLS.ACCOUNT.PROFILE)
}

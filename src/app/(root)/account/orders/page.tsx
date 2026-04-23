import { redirect } from 'next/navigation'
import { UI_URLS } from '@/common/constants'

export default function AccountOrdersPage() {
	redirect(UI_URLS.PROFILE.ORDERS)
}

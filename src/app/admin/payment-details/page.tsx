import { redirect } from 'next/navigation'
import { UI_URLS } from '@/common/constants'

export default function PaymentDetailsPage() {
	redirect(UI_URLS.ADMIN.PAYMENT_DETAILS_IBAN)
}

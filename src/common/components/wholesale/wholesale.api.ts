import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	createWholesaleInquiryResponseSchema,
	type CreateWholesaleInquiryResponse,
	type WholesaleInquiryFormValues
} from './wholesale.schema'

export const wholesaleApi = {
	create: (values: WholesaleInquiryFormValues): Promise<CreateWholesaleInquiryResponse> =>
		httpService.post(
			API_URLS.WHOLESALE.BASE,
			{
				name: values.name.trim(),
				phone: values.phone.trim(),
				email: values.email.trim(),
				quantity: values.quantity.trim(),
				...(values.comment?.trim() ? { comment: values.comment.trim() } : {})
			},
			{ schema: createWholesaleInquiryResponseSchema, skipErrorToast: true }
		)
}

import { httpService } from '@/common/services/http.service'
import { API_BASE_URL, API_URLS } from '@/common/constants'
import { feedStatusSchema, feedSummarySchema } from './feed.schema'

export const feedApi = {
	/** Last generation summary without rebuilding; also says whether the XML is ready at all. */
	getStatus: () => httpService.get(API_URLS.FEEDS.GOOGLE_SHOPPING_STATUS, { schema: feedStatusSchema }),

	/** Synchronous rebuild; 409 while another generation is running. */
	regenerate: () =>
		httpService.post(API_URLS.FEEDS.GOOGLE_SHOPPING_REGENERATE, undefined, {
			schema: feedSummarySchema,
			skipErrorToast: true
		}),

	/** The public URL Merchant Center fetches — absolute, so it can be copied straight in. */
	publicXmlUrl: () => `${API_BASE_URL}${API_URLS.FEEDS.GOOGLE_SHOPPING_XML}`
}

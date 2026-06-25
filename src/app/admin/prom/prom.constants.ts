import { API_BASE_URL, API_URLS } from '@/common/constants'

/** Full URL for Prom availability SSE sync (GET + EventSource with credentials). */
export const getPromSyncStreamUrl = () =>
	`${API_BASE_URL.replace(/\/$/, '')}${API_URLS.PROM.SYNC_AVAILABILITY}`

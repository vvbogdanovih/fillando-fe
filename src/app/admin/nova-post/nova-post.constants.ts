import { API_BASE_URL, API_URLS } from '@/common/constants'

/** Full URL for Nova Post SSE sync (GET + EventSource with credentials). */
export const getNovaPostSyncStreamUrl = () =>
	`${API_BASE_URL.replace(/\/$/, '')}${API_URLS.NOVA_POST.SYNC}`

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

export const API_URLS = {
	AUTH: {
		GOOGLE: `/auth/google`, // GET  — redirects to Google OAuth consent screen
		LOGIN: `/auth/login`, // POST — { email, password } → { message, user }
		REGISTER: `/auth/register`, // POST — { name, email, password } → { message, user }
		REFRESH: `/auth/refresh`, // POST — refreshes access token via HttpOnly cookie
		LOGOUT: `/auth/logout`, // POST — clears the session cookie server-side
		ME: `/auth/me` // GET  — returns current user from active cookie session
	},
	USERS: {
		BASE: `/users`, // GET — admin paginated user list
		ME: `/users/me` // GET/PATCH — current user profile
	},
	CATEGORIES: {
		BASE: `/categories`, // GET — full list / POST — create category
		BY_ID: (id: string) => `/categories/${id}`, // GET/PATCH/DELETE
		BY_SLUG: (slug: string) => `/categories/slug/${slug}` // GET — resolve slug to category doc
	},
	COLORS: {
		BASE: `/colors`, // GET — dictionary (public) / POST — create
		ADMIN: `/colors/admin`, // GET — dictionary + how many variants use each colour
		BY_ID: (id: string) => `/colors/${id}` // GET / PATCH / DELETE
	},
	LANDINGS: {
		BASE: `/landings`, // GET — published only (public) / POST — create
		ADMIN: `/landings/admin`, // GET — every landing including drafts
		SLUGS: `/landings/slugs`, // GET — sitemap source
		BY_SLUG: (categorySlug: string, landingSlug: string) =>
			`/landings/slug/${categorySlug}/${landingSlug}`,
		BY_ID: (id: string) => `/landings/${id}` // GET / PATCH / DELETE
	},
	VENDORS: {
		BASE: `/vendors`, // GET (list all) / POST (create)
		BY_ID: (id: string) => `/vendors/${id}`, // GET / PATCH / DELETE
		CHECK_AVAILABILITY: `/vendors/check-availability` // GET ?slug=...
	},
	UPLOAD: {
		PRESIGN: `/upload/presign`, // POST — get presigned S3 URL
		CONFIRM: `/upload/confirm` // POST — confirm upload
	},
	PRODUCTS: {
		BASE: `/products`, // GET (list) / POST (create)
		CATALOG: `/products/catalog`, // GET — paginated, filtered catalog for a category
		SEARCH: `/products/search`, // GET ?q=&page=&limit= — full-text product search
		PRICE_SHEET: `/products/price-sheet`, // GET ?q=&page=&limit= — public flat variant list (price sheet)
		PRICE_LIST_PDF: `/products/price-list/pdf`, // POST — admin wholesale price list PDF (blob response)
		BY_SLUG: (slug: string) => `/products/by-slug/${slug}`, // GET — variant detail + product + siblings
		BY_ID: (id: string) => `/products/${id}`, // GET / PATCH / DELETE
		VALIDATE: `/products/validate`, // POST — check slug + SKU uniqueness before create
		VARIANTS: (id: string) => `/products/${id}/variants`, // GET (list) / POST (add variant)
		VARIANT_BY_ID: (id: string, variantId: string) => `/products/${id}/variants/${variantId}`, // GET / PATCH / DELETE
		VARIANT_IMAGES: (id: string, variantId: string) =>
			`/products/${id}/variants/${variantId}/images` // PATCH — set variant images
	},
	CART: {
		BASE: `/cart`, // GET — fetch cart; DELETE — clear all
		ITEMS: `/cart/items`, // POST — add item { variant_id, quantity }
		ITEM: (variantId: string) => `/cart/items/${variantId}`, // PATCH — update quantity; DELETE — remove item
		MERGE: `/cart/merge` // POST — merge guest cart after login
	},
	PAYMENT_DETAILS: {
		BASE: `/payment-details`, // GET (list) / POST (create)
		BY_ID: (id: string) => `/payment-details/${id}`, // PATCH / DELETE
		ACTIVATE: (id: string) => `/payment-details/${id}/activate`, // PATCH — set active (deactivates others)
		ACTIVE: `/payment-details/active` // GET — public active record
	},
	PAYMENT_PROVIDERS: {
		BASE: `/payment-providers`, // GET (admin list) / POST (create)
		BY_ID: (id: string) => `/payment-providers/${id}`, // PATCH / DELETE
		ACTIVATE: (id: string) => `/payment-providers/${id}/activate`, // PATCH — set active (deactivates others of same provider)
		ACTIVE: (provider: string) => `/payment-providers/active/${provider}` // GET — public active provider (no secrets)
	},
	LIQPAY: {
		CHECKOUT: `/liqpay/checkout` // POST — build signed checkout payload for an order
	},
	ORDERS: {
		BASE: `/orders`, // POST — create order (guest or authenticated); GET — admin list
		LOOKUP: (orderNumber: string) => `/orders/lookup/${orderNumber}`, // GET ?token= — public payment status by order number + access token
		BY_ID: (id: string) => `/orders/${id}`, // GET — admin detail; PATCH — admin update
		ME: `/orders/me`, // GET — current user orders list
		ME_BY_ID: (id: string) => `/orders/me/${id}`, // GET — current user order detail
		STATUS: (id: string) => `/orders/${id}/status`, // PATCH — admin change order status
		PAYMENT_STATUS: (id: string) => `/orders/${id}/payment-status`, // PATCH — admin change payment status
		TTN: (id: string) => `/orders/${id}/ttn`, // PATCH — admin change Nova Post TTN
		INVOICE: (id: string) => `/orders/${id}/invoice`, // POST — admin generate PDF invoice
		VENDOR_EMAIL: (id: string) => `/orders/${id}/vendor-email`, // POST — admin send vendor email
		REPORT: `/orders/report` // POST — admin generate orders report (blob response)
	},
	COUPONS: {
		BASE: `/discount-coupons`, // GET (list) / POST (create)
		BY_ID: (id: string) => `/discount-coupons/${id}`, // GET / PATCH / DELETE
		VALIDATE: `/discount-coupons/validate` // POST — public coupon validation for checkout
	},
	NOVA_POST: {
		SYNC: `/nova-post/sync`, // GET — admin SSE stream: cities → warehouses progress, then done | error
		CITIES: `/nova-post/cities`, // GET ?q=
		WAREHOUSES: `/nova-post/warehouses` // GET ?cityRef=&type=&q=
	},
	PROM: {
		SYNC_AVAILABILITY: `/prom/sync-availability` // GET — admin SSE stream: per-variant availability sync progress, then done | error
	},
	WHOLESALE: {
		BASE: `/wholesale-inquiries`, // POST — public inquiry form; GET — admin paginated list
		STATUS: (id: string) => `/wholesale-inquiries/${id}/status` // PATCH — admin change inquiry status
	}
}

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
		WITH_SUBCATEGORIES: `/categories/with-subcategories`, // GET  — full list with embedded subcategory trees
		BASE: `/categories`, // POST — create category
		BY_ID: (id: string) => `/categories/${id}`, // GET/PATCH/DELETE
		BY_SLUG: (slug: string) => `/categories/slug/${slug}`, // GET — resolve slug to category doc
		SUBCATEGORIES: (catId: string) => `/categories/${catId}/subcategories`, // GET/POST
		SUBCATEGORY_BY_ID: (catId: string, subId: string) =>
			`/categories/${catId}/subcategories/${subId}` // GET/PATCH/DELETE
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
		CATALOG: `/products/catalog`, // GET — paginated, filtered catalog for a subcategory
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
	ORDERS: {
		BASE: `/orders`, // POST — create order (guest or authenticated); GET — admin list
		BY_ID: (id: string) => `/orders/${id}`, // GET — admin detail; PATCH — admin update
		ME: `/orders/me`, // GET — current user orders list
		ME_BY_ID: (id: string) => `/orders/me/${id}`, // GET — current user order detail
		STATUS: (id: string) => `/orders/${id}/status`, // PATCH — admin change order status
		PAYMENT_STATUS: (id: string) => `/orders/${id}/payment-status`, // PATCH — admin change payment status
		TTN: (id: string) => `/orders/${id}/ttn` // PATCH — admin change Nova Post TTN
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
	}
}

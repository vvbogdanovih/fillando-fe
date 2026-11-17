export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

/**
 * The largest page of the category cursor reads (tree, options, ancestors) — the backend's
 * `CATEGORY_PAGE.max` (fillando-be `category-tree.dto.ts`). Every walk asks for it; one place
 * to change if the backend's ceiling does.
 */
export const CATEGORY_TREE_PAGE_MAX = 1000

export const API_URLS = {
	CATALOG_SITEMAP: '/catalog/sitemap', // GET — index of the URL set's parts (revision, epoch, parts)
	CATALOG_SITEMAP_PART: '/catalog/sitemap/part', // GET ?revision&epoch[&from][&to] — one part
	PARTNER_TOKENS: '/admin/api-tokens',
	PARTNER_DOCS: '/partner-docs',
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
		ADMIN_TREE: '/categories/admin/tree',
		ADMIN_FILTER_PREVIEW: (id: string) => `/categories/${id}/admin/filter-preview`,
		ADMIN_CONFIGURATION: (id: string) => `/categories/${id}/admin/configuration`,
		ADMIN_DEFINITIONS: (id: string) => `/categories/${id}/admin/definitions`, // PATCH — characteristics (draft or published v2)
		ADMIN_DEFINITION_USAGE: (id: string) => `/categories/${id}/admin/definition-usage`, // GET — exact per-key usage
		ADMIN_CAPABILITIES: '/categories/admin/capabilities',
		DRAFT_CREATE: '/categories/drafts',
		ADMIN_DETAILS: (id: string) => `/categories/${id}/admin/details`, // PATCH — name + tile image (draft or published v2)
		DRAFT_PLACEMENT: (id: string) => `/categories/${id}/draft-placement`,
		DRAFT_DELETION: (id: string) => `/categories/${id}/admin/deletion`, // POST — remove an empty v2 draft
		DRAFT_CONVERSION: (id: string) => `/categories/${id}/admin/conversion`, // POST — empty draft group ↔ product; with plan_id — product → group by a stored plan
		ADMIN_CONVERSION_PLAN: (id: string) => `/categories/${id}/admin/conversion-plan`, // POST — read-only check of a product → group distribution
		ADMIN_SEO: (id: string) => `/categories/${id}/admin/seo`, // GET / PATCH — managed SEO copy (v2)
		ADMIN_EXPORT: (id: string) => `/categories/${id}/admin/export`, // GET / PATCH — Google taxonomy of a v2 category (feed)
		ADMIN_PUBLICATION: (id: string) => `/categories/${id}/admin/publication`,
		OPERATION: (id: string) => `/catalog-operations/${id}`,
		BASE: `/categories`, // POST — create category (GET — legacy full list, not read here: OPTIONS + BY_ID)
		OPTIONS: '/categories/options', // GET — product categories for selects, cursor-paginated (Plan-0010 D06)
		BY_ID: (id: string) => `/categories/${id}`, // GET/PATCH/DELETE
		BY_SLUG: (slug: string) => `/categories/slug/${slug}`, // GET — resolve slug to category doc
		ANCESTORS: (id: string) => `/categories/${id}/ancestors`, // GET — a path too long to embed, paged (Plan-0010 D06.4)
		TREE: '/categories/tree' // GET — public visible tree, flat, cursor-paginated
	},
	COLORS: {
		BASE: `/colors`, // GET — dictionary (public) / POST — create
		ADMIN: `/colors/admin`, // GET — dictionary + how many variants use each colour
		BY_ID: (id: string) => `/colors/${id}`, // GET / PATCH / DELETE
		// New admin (journal-backed; the legacy writes are closed once the catalogue control exists)
		ADMIN_ENTRIES: `/colors/admin/entries`, // GET — revision + dictionary / POST — create
		ADMIN_ENTRY: (id: string) => `/colors/${id}/admin`, // PATCH — update with its SKUs
		ADMIN_DELETION: (id: string) => `/colors/${id}/admin/deletion` // POST — remove unused
	},
	LANDINGS: {
		BASE: `/landings`, // GET — published only (public) / POST — create
		ADMIN: `/landings/admin`, // GET — every landing including drafts
		SLUGS: `/landings/slugs`, // GET — sitemap source
		BY_SLUG: (categorySlug: string, landingSlug: string) =>
			`/landings/slug/${categorySlug}/${landingSlug}`,
		BY_ID: (id: string) => `/landings/${id}`, // GET / PATCH / DELETE
		// Typed landings of v2 categories (Plan-0010 F07), journal-backed.
		TYPED_ADMIN: `/landings/admin/typed`, // GET ?category_id= / POST — create
		TYPED_ADMIN_ITEM: (id: string) => `/landings/${id}/admin/typed`, // PATCH
		TYPED_ADMIN_DELETION: (id: string) => `/landings/${id}/admin/deletion` // POST — drafts only
	},
	ROUTES: {
		RESOLVE: `/routes/resolve`, // GET ?path= — old address → current one (public)
		SLUG_CHANGE: (kind: 'variants' | 'categories' | 'landings', id: string) =>
			`/routes/${kind}/${id}/slug-change` // POST — redirect-backed address change (admin)
	},
	STOREFRONT_SETTINGS: {
		BASE: `/storefront-settings`, // GET — public projection / PATCH — admin save
		ADMIN: `/storefront-settings/admin` // GET — stored settings + revision
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
		TYPED_DRAFT_LIST: '/products/admin/typed-drafts',
		TYPED_DRAFT: (id: string) => `/products/${id}/admin/typed-draft`,
		TYPED_TRANSFER: (id: string) => `/products/${id}/admin/transfer`, // GET preview / POST move
		TYPED_DELETION: (id: string) => `/products/${id}/admin/deletion`, // POST — remove a never-sold product
		BASE: `/products`, // GET (list) / POST (create)
		CATALOG: `/products/catalog`, // GET — paginated, filtered catalog for a category
		CATALOG_V2: `/products/catalog/v2`, // GET — typed catalogue: category, group or whole catalogue
		CATALOG_V2_CATEGORY_COUNTS: `/products/catalog/v2/category-counts`, // GET — non-empty categories, paged (navigation, Plan-0010 D06.5)
		CATALOG_V2_STRIP: `/products/catalog/v2/strip`, // GET — a product strip: one card per product («Новинки», «Акції», a collection)
		SEARCH: `/products/search`, // GET ?q=&page=&limit= — full-text product search
		PRICE_SHEET: `/products/price-sheet`, // GET ?q=&page=&limit= — public flat variant list (price sheet)
		PRICE_LIST_PDF: `/products/price-list/pdf`, // POST — admin wholesale price list PDF (blob response)
		BY_SLUG: (slug: string) => `/products/by-slug/${slug}`, // GET — variant detail + product + siblings
		BY_ID: (id: string) => `/products/${id}`, // GET / PATCH / DELETE
		VALIDATE: `/products/validate`, // POST — check slug + SKU uniqueness before create
		VARIANTS: (id: string) => `/products/${id}/variants`, // GET (list) / POST (add variant)
		PROMOTION: (id: string) => `/products/${id}/promotion`, // PATCH — set/clear the promotion on every variant (TD-0012)
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
		LOOKUP_PAYMENT_METHOD: (orderNumber: string) =>
			`/orders/lookup/${orderNumber}/payment-method`, // PATCH ?token= — public: switch an unpaid order to COD/IBAN/CASH
		ME_PAYMENT_METHOD: (id: string) => `/orders/me/${id}/payment-method`, // PATCH — the same for the current user's own order
		BY_ID: (id: string) => `/orders/${id}`, // GET — admin detail; PATCH — admin update
		ME: `/orders/me`, // GET — current user orders list
		ME_BY_ID: (id: string) => `/orders/me/${id}`, // GET — current user order detail
		STATUS: (id: string) => `/orders/${id}/status`, // PATCH — admin change order status
		PAYMENT_STATUS: (id: string) => `/orders/${id}/payment-status`, // PATCH — admin change payment status
		TTN: (id: string) => `/orders/${id}/ttn`, // PATCH — admin change Nova Post TTN
		INVOICE: (id: string) => `/orders/${id}/invoice`, // POST — admin generate PDF invoice
		VENDOR_EMAIL: (id: string) => `/orders/${id}/vendor-email`, // POST — admin send vendor email
		REPORT: `/orders/report`, // POST — admin generate orders report (blob response)
		STATS: `/orders/stats` // GET ?date_from=&date_to= — admin dashboard figures (Kyiv calendar days, default the last 30)
	},
	COUPONS: {
		BASE: `/discount-coupons`, // GET (list) / POST (create)
		BY_ID: (id: string) => `/discount-coupons/${id}`, // GET / PATCH / DELETE
		VALIDATE: `/discount-coupons/validate` // POST — public coupon validation for checkout
	},
	NOVA_POST: {
		SYNC: `/nova-post/sync`, // GET — admin SSE stream: cities → warehouses progress, then done | error
		CITIES: `/nova-post/cities`, // GET ?q=
		WAREHOUSES: `/nova-post/warehouses` // GET ?cityRef=&type=PARCEL_LOCKER|BRANCH&q=
	},
	PROM: {
		SYNC_AVAILABILITY: `/prom/sync-availability` // GET — admin SSE stream: per-variant availability sync progress, then done | error
	},
	FEEDS: {
		GOOGLE_SHOPPING_XML: `/feeds/google-shopping.xml`, // GET — public Google Shopping feed; register in Merchant Center
		GOOGLE_SHOPPING_STATUS: `/feeds/google-shopping/status`, // GET — admin: last generation summary, readiness, last error
		GOOGLE_SHOPPING_REGENERATE: `/feeds/google-shopping/regenerate` // POST — admin: rebuild now, returns the summary; 409 while running
	},
	WHOLESALE: {
		BASE: `/wholesale-inquiries`, // POST — public inquiry form; GET — admin paginated list
		STATUS: (id: string) => `/wholesale-inquiries/${id}/status` // PATCH — admin change inquiry status
	}
}

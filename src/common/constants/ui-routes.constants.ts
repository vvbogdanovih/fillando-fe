export const UI_URLS = {
	HOME: '/',
	NOT_FOUND: '/404',
	CHECKOUT: '/checkout',
	CHECKOUT_SUCCESS: '/checkout/success',
	CATALOG: {
		FILAMENT: '/vytratni-materialy-dlia-3d-druku/filament'
	},
	AUTH: {
		BASE: '/auth',
		LOGIN: '/auth/login',
		REGISTER: '/auth/register',
		SUCCESS: '/auth/success'
	},
	ACCOUNT: {
		BASE: '/account',
		PROFILE: '/account/profile',
		ORDERS: '/profile/orders',
		SETTINGS: '/account/settings'
	},
	PROFILE: {
		BASE: '/profile',
		ORDERS: '/profile/orders',
		ORDER_DETAILS: (id: string) => `/profile/orders/${id}`
	},
	ADMIN: {
		BASE: '/admin',
		ORDERS: '/admin/orders',
		ORDER_DETAILS: (id: string) => `/admin/orders/${id}`,
		COUPONS: '/admin/coupons',
		CATEGORIES: '/admin/categories',
		VENDORS: '/admin/vendors',
		USERS: '/admin/users',
		PRODUCTS: '/admin/products',
		CREATE_PRODUCT: '/admin/products/create',
		EDIT_PRODUCT: (id: string) => `/admin/products/${id}/edit`,
		PAYMENT_DETAILS: '/admin/payment-details',
		PAYMENT_DETAILS_IBAN: '/admin/payment-details/iban',
		PAYMENT_DETAILS_LIQPAY: '/admin/payment-details/liqpay',
		PAYMENT_DETAILS_MONOPAY: '/admin/payment-details/monopay',
		PAYMENT_DETAILS_CASH: '/admin/payment-details/cash',
		STYLE_GUIDE: '/admin/style-guide'
	}
}

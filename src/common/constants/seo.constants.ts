export const NO_INDEX = { robots: { index: false, follow: false } }

export const SITE_NAME = 'Fillando'
export const SITE_DESCRIPTION =
	'Філамент та витратні матеріали для 3D-друку — широкий вибір PLA, PETG, ABS, TPU у Fillando'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// Значення value — орієнтовний тариф Нової Пошти для посилки ~1,3 кг (котушка 1 кг),
// фактична вартість залежить від ваги та регіону
export const OFFER_SHIPPING_DETAILS = {
	'@type': 'OfferShippingDetails',
	shippingRate: {
		'@type': 'MonetaryAmount',
		value: 97,
		currency: 'UAH'
	},
	shippingDestination: {
		'@type': 'DefinedRegion',
		addressCountry: 'UA'
	},
	deliveryTime: {
		'@type': 'ShippingDeliveryTime',
		handlingTime: {
			'@type': 'QuantitativeValue',
			minValue: 0,
			maxValue: 1,
			unitCode: 'DAY'
		},
		transitTime: {
			'@type': 'QuantitativeValue',
			minValue: 1,
			maxValue: 3,
			unitCode: 'DAY'
		}
	}
}

// Умови зі сторінки /returns: 14 днів за ЗУ «Про захист прав споживачів»,
// зворотну пересилку товару належної якості оплачує покупець
export const MERCHANT_RETURN_POLICY = {
	'@type': 'MerchantReturnPolicy',
	applicableCountry: 'UA',
	returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
	merchantReturnDays: 14,
	returnMethod: 'https://schema.org/ReturnByMail',
	returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
	refundType: 'https://schema.org/FullRefund'
}

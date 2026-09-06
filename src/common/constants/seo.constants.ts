export const NO_INDEX = { robots: { index: false, follow: false } }

export const SITE_NAME = 'Fillando'
export const SITE_DESCRIPTION =
	'Філамент та витратні матеріали для 3D-друку — широкий вибір PLA, PETG, ABS, TPU у Fillando'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// Доставка більше не константа: вона рахується з ваги варіанта таблицею ставок у
// `common/utils/shipping.utils.ts` (TD-0006 §5.4). Товар без ваги — без shippingDetails.

// Умови зі сторінки /returns: 14 днів за ЗУ «Про захист прав споживачів»,
// зворотну пересилку товару належної якості оплачує покупець; дефектний товар (/returns §5)
// повертається за рахунок продавця — саме це описує itemDefectReturnFees.
export const MERCHANT_RETURN_POLICY = {
	'@type': 'MerchantReturnPolicy',
	applicableCountry: 'UA',
	returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
	merchantReturnDays: 14,
	returnMethod: 'https://schema.org/ReturnByMail',
	returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
	itemDefectReturnFees: 'https://schema.org/FreeReturn',
	refundType: 'https://schema.org/FullRefund'
}

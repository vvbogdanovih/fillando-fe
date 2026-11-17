import type { TreeItem } from './category-tree.api'

/** Iterative traversal supports arbitrary depth without recursive React components. */
export function treeRows(items: TreeItem[], collapsed: ReadonlySet<string> = new Set()) {
	const children = new Map<string | null, TreeItem[]>()
	for (const item of items) {
		const siblings = children.get(item.parent_id) ?? []
		siblings.push(item)
		children.set(item.parent_id, siblings)
	}
	for (const siblings of children.values())
		siblings.sort(
			(a, b) =>
				a.order - b.order ||
				a.name.localeCompare(b.name, 'uk') ||
				a._id.localeCompare(b._id)
		)
	const stack = [...(children.get(null) ?? [])].reverse().map(item => ({ item, depth: 0 }))
	const result: { item: TreeItem; depth: number; hasChildren: boolean }[] = []
	const seen = new Set<string>()
	while (stack.length) {
		const { item, depth } = stack.pop()!
		if (seen.has(item._id)) throw Error('Дерево містить цикл')
		seen.add(item._id)
		const nested = children.get(item._id) ?? []
		result.push({ item, depth, hasChildren: nested.length > 0 })
		if (!collapsed.has(item._id))
			for (let i = nested.length - 1; i >= 0; i--)
				stack.push({ item: nested[i], depth: depth + 1 })
	}
	if (!collapsed.size && seen.size !== items.length)
		throw Error('Дерево містить недоступні категорії')
	return result
}
/**
 * Groups a category may move under: never itself or its own branch. A published category keeps its
 * storefront visibility, so it moves only under a published group (an active group always has an
 * active parent chain) — the server refuses anything else with CATEGORY_PARENT_NOT_PUBLIC.
 */
export function allowedParents(
	items: TreeItem[],
	selectedId?: string,
	{ publicOnly = false }: { publicOnly?: boolean } = {}
) {
	const excluded = new Set<string>()
	if (selectedId) {
		const children = new Map<string, string[]>()
		for (const item of items)
			if (item.parent_id) {
				const nested = children.get(item.parent_id) ?? []
				nested.push(item._id)
				children.set(item.parent_id, nested)
			}
		const stack = [selectedId]
		while (stack.length) {
			const current = stack.pop()!
			if (excluded.has(current)) continue
			excluded.add(current)
			for (const child of children.get(current) ?? []) stack.push(child)
		}
	}
	return items.filter(
		item =>
			item.kind === 'group' &&
			!excluded.has(item._id) &&
			(!publicOnly || item.status === 'active')
	)
}
/**
 * A read answered for another catalogue revision than the tree on screen. Thrown by the editors'
 * own queries, so it carries its wording: without a class it fell through to «Результат запиту
 * потребує перевірки», which points at an operation that never happened.
 */
export class CatalogChangedError extends Error {
	constructor(message = 'Каталог змінився. Оновіть дерево.') {
		super(message)
		this.name = 'CatalogChangedError'
	}
}

export const plural = (n: number, one: string, few: string, many: string) => {
	const tens = n % 100,
		units = n % 10
	const word =
		tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many
	return `${n} ${word}`
}
export interface DefinitionUsageCounts {
	products: number
	variants: number
	landings: number
}
/** «36 товарів, 301 SKU, 2 посадкові сторінки» — what a characteristic touches. */
export function describeUsage(usage: DefinitionUsageCounts) {
	const parts = [
		usage.products ? plural(usage.products, 'товар', 'товари', 'товарів') : '',
		usage.variants ? `${usage.variants} SKU` : '',
		usage.landings
			? plural(
					usage.landings,
					'посадкова сторінка',
					'посадкові сторінки',
					'посадкових сторінок'
				)
			: ''
	].filter(Boolean)
	return parts.join(', ')
}
interface DefinitionRefusal {
	code?: string
	label?: string | null
	option?: { label: string } | null
	usage?: DefinitionUsageCounts
}
/** A characteristic change the server refused, explained with what it would have broken. */
function definitionRefusal(details: DefinitionRefusal): string | undefined {
	const label = `«${details.label ?? 'характеристика'}»`
	const usage = details.usage ?? { products: 0, variants: 0, landings: 0 }
	const uses = describeUsage(usage)
	switch (details.code) {
		case 'DEFINITION_IN_USE':
			return `Характеристику ${label} не можна прибрати: її використовують ${uses}. Спершу приберіть значення з товарів і закріплення з посадкових сторінок.`
		case 'DEFINITION_TYPE_LOCKED':
			return `Тип, кількість значень і призначення характеристики ${label} не змінюються, поки її використовують ${uses}. Створіть нову характеристику потрібного типу й перенесіть значення.`
		case 'DEFINITION_UNIT_LOCKED':
			return `Одиницю характеристики ${label} не можна змінити: значення вже мають ${describeUsage({ ...usage, landings: 0 })}. Значення не перераховуються — «1000 г» стали б «1000 кг». Створіть нову характеристику з потрібною одиницею й перенесіть значення.`
		case 'OPTION_IN_USE':
			return `Варіант «${details.option?.label ?? ''}» характеристики ${label} не можна видалити: його використовують ${uses}. Його можна перейменувати.`
		case 'FILTER_PINNED':
			return `Фільтр ${label} закріплений на ${plural(usage.landings, 'посадковій сторінці', 'посадкових сторінках', 'посадкових сторінках')} — спершу змініть їхні закріплення.`
		case 'AXIS_REQUIRED':
			return `${label} — варіація товарів (${usage.variants} SKU), тому вона обов’язкова. Зробити її необов’язковою можна, лише коли жоден товар за нею не варіюється.`
		case 'REQUIRED_VALUES_MISSING':
			return `${label} не може бути обов’язковою в опублікованій категорії: значення немає в ${plural(usage.products, 'товарі', 'товарах', 'товарах')}. Додайте її необов’язковою, заповніть у товарах, потім зробіть обов’язковою.`
		case 'DEFINITION_CHANGE_INVALIDATES_DATA':
			return `Зміна зробила б некоректними наявні дані (${uses}). Перевірте типи й варіанти.`
	}
}

/**
 * `pending` — the caller keeps the operation's key (a write whose outcome is unknown): only then
 * does the last-resort sentence point at the operation's status. A read, or a refusal that
 * released the key, has no operation on screen to check.
 */
export function categoryError(error: unknown, pending = false) {
	if (error instanceof CatalogChangedError)
		return { code: 'CATALOG_CHANGED', status: undefined, message: error.message }
	const value = error as {
		status?: number
		details?: { details?: DefinitionRefusal }
		message?: string
	}
	const code = value?.details?.details?.code
	const refusal = value?.details?.details && definitionRefusal(value.details.details)
	if (refusal) return { code, status: value?.status, message: refusal }
	// Which category has the name or address, and which of the two collided (P01).
	const identity = value?.details?.details as
		| { conflict?: { field: 'name' | 'slug'; category: { name: string; slug: string } } }
		| undefined
	if (code === 'CATEGORY_IDENTITY_CONFLICT' && identity?.conflict) {
		const { field, category } = identity.conflict
		return {
			code,
			status: value?.status,
			message:
				field === 'name'
					? `Назва «${category.name}» вже є в іншої категорії (/${category.slug}). Оберіть іншу назву.`
					: `Адреса /${category.slug} уже зайнята категорією «${category.name}». Оберіть іншу адресу.`
		}
	}
	const messages: Record<string, string> = {
		VARIANT_STATUS_CONFLICT:
			'Статус варіанта вже змінився. Оновіть дерево і відкрийте товар повторно.',
		VARIANT_AXIS_REQUIRED: 'Спочатку налаштуйте вісь варіантів.',
		DUPLICATE_VARIANT_VALUE:
			'Таке значення варіанта вже існує, можливо, в архіві. Відновіть наявний варіант.',
		// The Prom sync rewrites price and stock between the read and the save; the screen has
		// already read the product again by the time this is shown.
		PRODUCT_DETAILS_CHANGED:
			'Дані товару оновились (ціна чи залишок) — перевірте й збережіть ще раз.',
		VENDOR_NOT_FOUND: 'Постачальника не знайдено. Оновіть список постачальників.',
		PRODUCT_EDIT_REQUIRES_DRAFT:
			'Ця операція доступна лише для чернеток товарів у чернетці категорії.',
		SKU_COUNTER_UNAVAILABLE:
			'Лічильник артикулів не підготовлений. Потрібно перевірити налаштування каталогу.',
		SKU_COUNTER_CONFLICT: 'Не вдалося зарезервувати артикули. Перевірте лічильник каталогу.',
		PRODUCT_IDENTITY_INDEX_MISSING:
			'Каталог ще не підготовлений до створення товарів: відсутній захист унікальності артикулів або адрес.',
		PRODUCT_IDENTITY_CONFLICT: 'Не вдалося призначити унікальну адресу товару.',
		INVALID_DEFINITION: 'Перевірте типи, одиниці та варіанти характеристик.',
		UNKNOWN_KEY: 'Налаштування містять невідомий ключ. Оновіть конфігурацію категорії.',
		CATEGORY_DEFINITIONS_REQUIRE_PRODUCT:
			'Характеристики налаштовуються у товарній категорії, а не в групі.',
		CATEGORY_REVISION_CONFLICT: 'Каталог уже змінився. Оновіть дерево перед наступною зміною.',
		CATEGORY_IDENTITY_CONFLICT: 'Така назва або адреса вже існує.',
		CATEGORY_CYCLE: 'Категорію не можна перенести в саму себе або її підкатегорію.',
		PARENT_NOT_GROUP: 'Батьківською категорією може бути лише група.',
		CATALOG_DRAFT_WRITES_DISABLED: 'Редагування дерева ще не ввімкнено.',
		CATALOG_WRITE_IN_PROGRESS: 'Каталог зараз оновлюється.',
		// A read while another operation holds the catalogue, or one that met a change half-way.
		CATALOG_MAINTENANCE: 'Каталог зараз оновлюється. Спробуйте трохи згодом.',
		CATALOG_READ_CHANGED: 'Каталог змінився під час запиту. Оновіть дерево.',
		// Publication refused before the revision is compared: the tree on screen is behind.
		CATEGORY_NOT_DRAFT: 'Категорія вже не чернетка. Оновіть дерево.',
		CATEGORY_NOT_ACTIVE: 'Категорія вже не опублікована. Оновіть дерево.',
		CATEGORY_HAS_ACTIVE_CHILDREN: 'Спочатку зніміть з публікації вкладені категорії.',
		CATEGORY_PARENT_NOT_PUBLIC:
			'Опубліковану категорію можна перенести лише в опубліковану групу або в корінь — інакше вона зникла б з сайту.',
		CONVERSION_ASSIGNMENTS_INVALID:
			'Розподіл неповний: кожен товар і кожну посадкову сторінку треба призначити в іншу категорію.',
		CONVERSION_TARGET_INVALID:
			'Цільовою може бути лише інша товарна категорія нового каталогу (чернетка або опублікована).',
		PUBLICATION_CHANGED:
			'Поки категорія публікувалася частинами, з’явилися нові готові товари. Опублікуйте її ще раз.',
		CONVERSION_PLAN_STALE:
			'Після перевірки плану каталог змінився. Оновіть дерево й перевірте план ще раз.',
		CONVERSION_PLAN_CHANGED:
			'Дані товарів чи сторінок змінилися після перевірки плану. Перевірте план ще раз.',
		CONVERSION_PLAN_BLOCKED: 'План більше не виконується. Перевірте його ще раз.',
		CONVERSION_PLAN_NOT_FOUND: 'План не знайдено або його вже виконано. Перевірте план ще раз.',
		CATEGORY_ARCHIVED: 'Категорію архівовано — її не редагують.',
		VARIANT_DELETE_REQUIRES_INACTIVE:
			'Видалити можна лише чернетку або архівний варіант. Активний спершу архівуйте.',
		PRODUCT_DELETE_REQUIRES_INACTIVE:
			'Товар має активні варіанти. Спершу «Архівувати всі варіанти», потім видаляйте.',
		PRODUCT_NEEDS_A_VARIANT:
			'Це останній варіант товару. Щоб прибрати все, видаліть товар повністю.',
		VARIANT_IN_USE:
			'Варіант уже продавали або він у кошику, зв’язку чи старій адресі — його можна лише архівувати.',
		PRODUCT_IN_USE:
			'Товар уже продавали або на нього посилається інший товар, добірка вітрини чи стара адреса — його можна лише архівувати.',
		// A SKU goes on sale only in a complete product (owner, 2026-11-15); the forms list the gaps
		// before sending, this is the server's own refusal.
		PRODUCT_NOT_READY:
			'Активним варіант стає лише в повному товарі: опис, обов’язкові характеристики, ціна більша за нуль і фото. Заповніть їх або залиште «Чернетка».',
		PROMO_ENDS_IN_PAST: 'Дата завершення акції має бути в майбутньому.',
		PROMO_PERCENT_REQUIRED: 'Дата завершення акції потребує відсотка знижки.',
		CATEGORY_DETAILS_UNCHANGED: 'Змін немає.',
		CATEGORY_IN_USE:
			'Категорія не порожня: спершу перенесіть товари, підкатегорії та посадкові сторінки.',
		CATEGORY_DELETE_REQUIRES_DRAFT:
			'Видаляти можна лише чернетку. Опубліковану категорію спершу зніміть з публікації.',
		CATEGORY_CONVERSION_REQUIRES_DRAFT: 'Змінити тип можна лише в чернетці категорії.',
		CATEGORY_KIND_UNCHANGED: 'Категорія вже має цей тип. Оновіть дерево.',
		TRANSFER_PLAN_CHANGED:
			'Товар або категорія змінилися після перевірки. Перевірте перенесення ще раз.',
		TRANSFER_AXIS_INCOMPATIBLE: 'Вісь варіантів товару не підходить до цільової категорії.',
		TRANSFER_TARGET_INVALID:
			'Переносити можна лише в товарну категорію нового каталогу (чернетку або опубліковану).',
		TRANSFER_SAME_CATEGORY: 'Товар уже в цій категорії.',
		// Any save of a published product, a price edit included — not only a transfer.
		REQUIRED_VALUE: 'Не заповнено обов’язкову характеристику товару.',
		INVALID_AXIS:
			'Варіацію можна будувати лише з обов’язкової характеристики: списку, числа, так/ні або кольору.',
		COLOR_VALUE_ON_SKU:
			'Колір обирається для кожного SKU зі словника — зробіть «Колір» варіацією товару.',
		LANDING_FILTERS_INVALID:
			'Закріплені фільтри не підходять до характеристик категорії. Перевірте вибрані значення.',
		LANDING_PINS_REQUIRED:
			'Посадкова сторінка має закріпити хоча б одне значення, інакше вона дублює сторінку категорії.',
		LANDING_SLUG_TAKEN:
			'Така адреса вже є в цій категорії (зокрема як стара адреса іншої сторінки).',
		LANDING_SLUG_LOCKED:
			'Адресу опублікованої сторінки не змінюють звичайним збереженням: це окрема операція з перенаправленням.',
		LANDING_FILTERS_DUPLICATE:
			'Інша посадкова сторінка цієї категорії вже має ті самі фільтри.',
		LANDING_HAS_NO_PRODUCTS:
			'Під ці фільтри не підпадає жоден активний товар — опублікувати не можна. Збережіть як чернетку.',
		LANDING_UNCHANGED: 'Змін немає.',
		LANDING_DELETE_REQUIRES_DRAFT: 'Видалити можна лише чернетку. Спершу зніміть з публікації.',
		LANDING_CATEGORY_INVALID:
			'Посадкові сторінки нового каталогу — лише для товарної категорії.',
		SEO_UNCHANGED: 'Змін немає.',
		CATEGORY_SEO_UNAVAILABLE:
			'SEO редагується лише для чернетки або опублікованої категорії нового каталогу.',
		EXPORT_UNCHANGED: 'Змін немає.',
		CATEGORY_EXPORT_UNAVAILABLE:
			'Категорія Google — лише для товарної категорії нового каталогу.',
		ROUTE_PATH_TAKEN:
			'Ця адреса зайнята іншим товаром, категорією чи сторінкою (зокрема як стара адреса).',
		ROUTE_PATH_RESERVED:
			'Ця адреса зарезервована сайтом (наприклад, admin, catalog, products).',
		ROUTE_SLUG_UNCHANGED: 'Адреса вже така.',
		ROUTE_ENTITY_UNAVAILABLE:
			'Адресу змінюють лише для чернетки або опублікованої категорії нового каталогу.',
		INVALID_SLUG: 'Адреса: малі латинські літери, цифри й дефіс.'
	}
	return {
		code,
		status: value?.status,
		message:
			(code && messages[code]) ||
			(value?.status === 400
				? 'Перевірте заповнення полів.'
				: value?.status === 404
					? 'Об’єкт каталогу не знайдено. Оновіть дерево.'
					: '') ||
			(pending
				? 'Результат запиту потребує перевірки. Перевірте стан операції нижче.'
				: 'Запит не виконано. Оновіть дерево й спробуйте ще раз.')
	}
}

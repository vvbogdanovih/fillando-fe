import '@/common/lib/zod-locale'
import * as z from 'zod'

/** The 15 buckets the catalogue swatch filter groups by (TD-0002 §5.2.2). */
export const COLOR_FAMILIES = [
	'black',
	'white',
	'gray',
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
	'pink',
	'brown',
	'gold',
	'silver',
	'transparent',
	'multicolor'
] as const

export type ColorFamily = (typeof COLOR_FAMILIES)[number]

/** Ukrainian labels for the admin — the stored value stays the English enum. */
export const COLOR_FAMILY_LABELS: Record<ColorFamily, string> = {
	black: 'Чорні',
	white: 'Білі',
	gray: 'Сірі',
	red: 'Червоні',
	orange: 'Помаранчеві',
	yellow: 'Жовті',
	green: 'Зелені',
	blue: 'Сині',
	purple: 'Фіолетові',
	pink: 'Рожеві',
	brown: 'Коричневі',
	gold: 'Золоті',
	silver: 'Срібні',
	transparent: 'Прозорі',
	multicolor: 'Багатокольорові'
}

export const HEX_STOP_PATTERN = /^#[0-9a-fA-F]{6}$/

// --- Response schema ---

export const colorSchema = z.object({
	_id: z.string(),
	name_en: z.string(),
	name_uk: z.string(),
	slug: z.string(),
	family: z.enum(COLOR_FAMILIES),
	hex_stops: z.array(z.string()),
	order: z.number().default(0),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
})

export const colorsListSchema = z.array(colorSchema)

export type Color = z.infer<typeof colorSchema>

// --- Form schema ---

export const colorFormSchema = z.object({
	name_en: z.string().min(1, 'Англійська назва є обов’язковою'),
	name_uk: z.string().min(1, 'Українська назва є обов’язковою'),
	// Optional: the API derives it from `name_en` when left blank.
	slug: z.string().optional(),
	family: z.enum(COLOR_FAMILIES),
	hex_stops: z
		.array(z.string().regex(HEX_STOP_PATTERN, 'Формат: #RRGGBB'))
		.min(1, 'Потрібен хоча б один колір')
		// Six is the point past which a 24px circle stops being readable.
		.max(6, 'Не більше шести кольорів'),
	order: z.number().int().min(0).optional()
})

export type ColorFormValues = z.infer<typeof colorFormSchema>

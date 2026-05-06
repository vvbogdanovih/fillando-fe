const CYRILLIC_MAP: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'h',
	ґ: 'g',
	д: 'd',
	е: 'e',
	є: 'ie',
	ж: 'zh',
	з: 'z',
	и: 'y',
	і: 'i',
	ї: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ь: '',
	ю: 'iu',
	я: 'ia'
}

export const toAttrKey = (label: string): string =>
	label
		.normalize('NFD')
		.toLowerCase()
		.split('')
		.map(ch => CYRILLIC_MAP[ch] ?? ch)
		.join('')
		.replace(/[\s-]+/g, '_')
		.replace(/[^a-z0-9_]/g, '')

export const toSlug = (label: string): string =>
	label
		.normalize('NFD')
		.toLowerCase()
		.split('')
		.map(ch => CYRILLIC_MAP[ch] ?? ch)
		.join('')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')

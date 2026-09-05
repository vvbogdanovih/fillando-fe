/**
 * Human labels for the values the catalogue filters by.
 *
 * The values themselves are the canonical strings the taxonomy migration writes into
 * `product.attributes[].v` — `CF`, `Silk`, `PA6` — because that is what the query matches on and
 * what the landings pin. They are not what a shopper reads: «CF» on its own means nothing to
 * someone buying their first roll of filament.
 *
 * This map is the one place to reword them. A value missing from it falls through unchanged,
 * which is deliberate: a new material added tomorrow shows its canonical name rather than
 * nothing, and the filter keeps working.
 *
 * Only the filter controls and the chips use this. The product page's specification table
 * prints the stored value, because there the dimension label already carries the meaning
 * («Ефект поверхні: Silk»).
 */
const VALUE_LABELS: Record<string, Record<string, string>> = {
	// Polymer codes are how the material is sold and searched for, so the code leads and the
	// gloss follows — but only where the code alone is opaque.
	polymer: {
		TPU: 'TPU (Flex)',
		PA6: 'PA6 (Нейлон)'
	},
	finish: {
		Silk: 'Шовковий (Silk)',
		Matte: 'Матовий (Matte)',
		Glow: 'Світиться в темряві (Glow)',
		Luminous: 'Люмінесцентний (Luminous)',
		Rainbow: 'Веселка (Rainbow)',
		Gradient: 'Градієнт (Gradient)',
		'Dual-Silk': 'Двоколірний шовк (Dual-Silk)',
		'Tri-Silk': 'Триколірний шовк (Tri-Silk)',
		Wood: 'Під дерево (Wood)',
		'Temperature Changing': 'Термохромний (Temperature Changing)'
	},
	reinforcement: {
		CF: 'Вуглеволокно (CF)',
		GF: 'Скловолокно (GF)'
	},
	series: {
		Standard: 'Стандарт (Standard)',
		'High Speed': 'Швидкісний (High Speed)'
	}
}

export const attributeValueLabel = (attrKey: string, value: string): string =>
	VALUE_LABELS[attrKey]?.[value] ?? value

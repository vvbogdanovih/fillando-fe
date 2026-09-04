/**
 * Warnings a shopper needs *before* deciding, keyed by the attribute value that triggers them.
 *
 * They render above the buy button, not in the description: the description sits below the CTA,
 * so a warning there arrives after the decision has already been made (TD-0002 §5.2.1).
 *
 * Generic by design — the key is the attribute key, and the map inside it is value → note — so
 * the next such case needs data, not code.
 */
export const ATTR_NOTES: Record<string, Record<string, { title: string; text: string }>> = {
	spool_included: {
		'Ні (рефіл)': {
			title: 'Це рефіл — без котушки',
			text: 'Намотка постачається без пластикової котушки. Щоб друкувати, потрібна власна багаторазова котушка (masterspool) або тримач для рефілу.'
		}
	}
}

/**
 * The same warning, matched on the variant instead of the product.
 *
 * `spool_included` lives on the product, but this shop's refill is a *variant* sitting next to
 * spooled colours on one product (FL-000253, "Clear Безбарвний Refill"), which TD-0002 §5.2.1
 * did not anticipate. Until that refill becomes its own product the attribute cannot be set, so
 * the marker in the variant value is the only thing that can trigger the warning.
 */
export const REFILL_VARIANT_PATTERN = /\brefill\b|рефіл/i

export const REFILL_NOTE = ATTR_NOTES.spool_included['Ні (рефіл)']

import { InfoIcon } from 'lucide-react'

/**
 * What happens when the weight is left blank (artboard «Нові поля у формах», Plan-0005 I-31).
 *
 * The behaviour was already there — the feed omits `shipping_weight` and the product page falls
 * back to «за тарифом перевізника» — but nothing on the screen said so, so the empty field read
 * as an unfinished one. Both forms that carry the weight field show the same sentence.
 */
export const WeightInfoNote = () => (
	<div className='flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900'>
		<InfoIcon className='mt-0.5 size-4 shrink-0' />
		<p className='text-xs'>
			Порожня вага не блокує нічого: товар просто йде у фід без{' '}
			<span className='font-mono'>shipping_weight</span>, а на сторінці товару доставка
			показується «за тарифом перевізника». Для наявних товарів вагу проставить міграція за
			назвою («1kg», «3кг»), решту — вручну.
		</p>
	</div>
)

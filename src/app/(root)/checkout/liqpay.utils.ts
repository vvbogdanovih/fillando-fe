import { initLiqpayCheckout } from './checkout.api'

/** Builds a transient hidden form and POSTs it to LiqPay, redirecting the browser. */
export function submitLiqpayForm(actionUrl: string, data: string, signature: string) {
	const form = document.createElement('form')
	form.method = 'POST'
	form.action = actionUrl
	form.acceptCharset = 'utf-8'
	for (const [name, value] of [
		['data', data],
		['signature', signature]
	]) {
		const input = document.createElement('input')
		input.type = 'hidden'
		input.name = name
		input.value = value
		form.appendChild(input)
	}
	document.body.appendChild(form)
	form.submit()
	form.remove()
}

/** Fetches the signed LiqPay payload for an order and hands the browser over to LiqPay. */
export async function startLiqpayCheckout(orderNumber: string): Promise<void> {
	const checkout = await initLiqpayCheckout(orderNumber)
	submitLiqpayForm(checkout.action_url, checkout.data, checkout.signature)
}

// Mock backend for the Playwright suite: the handful of routes the storefront hits between
// `/checkout` and `/checkout/success`, with fixed answers. No database, no auth, no LiqPay.
//
//   node e2e/mock-api.mjs            (Playwright starts it via playwright.config.ts webServer)
//
// Every request is logged to stdout and kept in memory; the specs read the log through
// `GET /__e2e/requests` and reset it with `DELETE /__e2e/requests`.
//
// Env: MOCK_API_PORT (default 9001), MOCK_API_ALLOW_ORIGIN — the storefront origin allowed by
// CORS (default http://localhost:9100, the port playwright.config.ts starts `next dev` on).
import http from 'node:http'

const PORT = Number(process.env.MOCK_API_PORT ?? 9001)
const STOREFRONT_ORIGIN = process.env.MOCK_API_ALLOW_ORIGIN ?? 'http://localhost:9100'

const ORDER_NUMBER = 'FO-0000123'
const ORDER_TOTAL = 700
/** 32 lowercase hex chars, like the real token. Ends in `a` so the lookup reports PAID. */
const PAYMENT_ACCESS_TOKEN = '0123456789abcdef0123456789abcdea'
/** Stands in for https://www.liqpay.ua/api/3/checkout — the hidden form POSTs here. */
const LIQPAY_SINK = `http://localhost:${PORT}/liqpay-sink`

/** @type {{ method: string, path: string, query: Record<string, string>, body: unknown, status: number }[]} */
const requestLog = []

/**
 * Token the page last looked each order up with. `POST /liqpay/checkout` only receives the
 * order number, so this is how the mock knows which scenario a retry belongs to.
 * @type {Map<string, string>}
 */
const lastLookupToken = new Map()

const json = (status, body) => ({ status, body, contentType: 'application/json; charset=utf-8' })
const html = (status, body) => ({ status, body, contentType: 'text/html; charset=utf-8' })

/**
 * The success page decides what to render from `payment_status`; the mock decides
 * `payment_status` from the LAST character of the token so one route serves every state.
 */
function paymentStatusForToken(token) {
	switch (token?.at(-1)) {
		case 'a':
			return 'PAID'
		case 'f':
			return 'FAILED'
		// Reads as FAILED so the retry button renders — but the retry itself is refused with
		// 400 "Order is already paid" (the order got PAID meanwhile: another tab, late callback).
		case 'p':
			return 'FAILED'
		case 'e':
			return 'PENDING'
		default:
			return null
	}
}

const isAlreadyPaidScenario = orderNumber => lastLookupToken.get(orderNumber)?.at(-1) === 'p'

function createOrder(body) {
	if (body?.comment === 'FAIL_STOCK') {
		return json(400, { message: 'Only 3 units available for SKU FIL-0001' })
	}
	if (body?.coupon_code === 'BADCOUPON1') {
		return json(400, { message: 'Invalid coupon code' })
	}
	// A fresh order has not been looked up yet.
	lastLookupToken.delete(ORDER_NUMBER)
	return json(201, {
		order_number: ORDER_NUMBER,
		subtotal_price: ORDER_TOTAL,
		total_price: ORDER_TOTAL,
		applied_discount: null,
		// Real backend: present only for LIQPAY orders.
		...(body?.payment_method === 'LIQPAY' ? { payment_access_token: PAYMENT_ACCESS_TOKEN } : {})
	})
}

function lookupOrder(orderNumber, token) {
	const paymentStatus = paymentStatusForToken(token)
	if (!paymentStatus) return json(404, { message: 'Order not found' })
	lastLookupToken.set(orderNumber, token)
	return json(200, {
		order_number: orderNumber,
		payment_method: 'LIQPAY',
		payment_status: paymentStatus,
		total_price: ORDER_TOTAL
	})
}

function handle(method, url, body) {
	const path = url.pathname

	// Test-only introspection of what the storefront actually called.
	if (path === '/__e2e/requests' && method === 'GET') return json(200, requestLog)
	if (path === '/__e2e/requests' && method === 'DELETE') {
		requestLog.length = 0
		lastLookupToken.clear()
		return { status: 204 }
	}

	// Boot: Providers → checkAuth → 401 → interceptor refresh → 401 → logOut. `/auth/logout`
	// MUST answer 200, or the interceptor loops refresh → logout → refresh forever.
	if (method === 'GET' && path === '/auth/me') return json(401, { message: 'Not authenticated' })
	if (method === 'POST' && path === '/auth/refresh') {
		return json(401, { message: 'Not authenticated' })
	}
	if (method === 'POST' && path === '/auth/logout') return json(200, { message: 'Logged out' })
	if (method === 'GET' && path === '/cart') return json(401, { message: 'Not authenticated' })
	if (method === 'GET' && path === '/categories') return json(200, [])

	// Checkout page
	if (method === 'GET' && path === '/nova-post/cities') return json(200, [])
	if (method === 'GET' && path === '/nova-post/warehouses') return json(200, [])
	if (method === 'GET' && path === '/payment-providers/active/LIQPAY') {
		return json(200, { provider: 'LIQPAY', sandbox: true })
	}
	if (method === 'GET' && path.startsWith('/payment-providers/active/')) {
		return json(404, { message: 'Active payment provider not found' })
	}
	if (method === 'POST' && path === '/discount-coupons/validate') {
		return json(200, { valid: false, reason: 'NOT_FOUND' })
	}
	if (method === 'POST' && path === '/orders') return createOrder(body)

	// LiqPay. Real backend: 400 once the order is PAID.
	if (method === 'POST' && path === '/liqpay/checkout') {
		if (isAlreadyPaidScenario(body?.order_number)) {
			return json(400, { message: 'Order is already paid' })
		}
		return json(200, { data: 'ZmFrZQ==', signature: 'sig', action_url: LIQPAY_SINK })
	}
	if (path === '/liqpay-sink') {
		return html(
			200,
			'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LIQPAY SINK</title></head><body><h1>LIQPAY SINK</h1></body></html>'
		)
	}

	// Success page
	const lookup = path.match(/^\/orders\/lookup\/([^/]+)$/)
	if (method === 'GET' && lookup) {
		return lookupOrder(decodeURIComponent(lookup[1]), url.searchParams.get('token'))
	}

	return json(404, { message: `Cannot ${method} ${path}` })
}

function readBody(req) {
	return new Promise(resolve => {
		const chunks = []
		req.on('data', chunk => chunks.push(chunk))
		req.on('error', () => resolve(undefined))
		req.on('end', () => {
			const raw = Buffer.concat(chunks).toString('utf8')
			if (!raw) return resolve(undefined)
			const type = req.headers['content-type'] ?? ''
			if (type.includes('application/json')) {
				try {
					return resolve(JSON.parse(raw))
				} catch {
					return resolve(raw)
				}
			}
			if (type.includes('application/x-www-form-urlencoded')) {
				return resolve(Object.fromEntries(new URLSearchParams(raw)))
			}
			resolve(raw)
		})
	})
}

function setCors(res) {
	res.setHeader('Access-Control-Allow-Origin', STOREFRONT_ORIGIN)
	res.setHeader('Access-Control-Allow-Credentials', 'true')
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'content-type')
	res.setHeader('Access-Control-Max-Age', '600')
	res.setHeader('Vary', 'Origin')
}

const server = http.createServer(async (req, res) => {
	const method = req.method ?? 'GET'
	const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
	setCors(res)

	if (method === 'OPTIONS') {
		res.writeHead(204)
		res.end()
		console.log(`[mock-api] ${method} ${req.url} -> 204`)
		return
	}

	const body = await readBody(req)
	const result = handle(method, url, body)

	if (!url.pathname.startsWith('/__e2e/')) {
		requestLog.push({
			method,
			path: url.pathname,
			query: Object.fromEntries(url.searchParams),
			body,
			status: result.status
		})
	}

	if (result.body === undefined) {
		res.writeHead(result.status)
		res.end()
	} else {
		const payload = result.contentType.startsWith('application/json')
			? JSON.stringify(result.body)
			: result.body
		res.writeHead(result.status, {
			'Content-Type': result.contentType,
			'Cache-Control': 'no-store'
		})
		res.end(payload)
	}
	console.log(`[mock-api] ${method} ${req.url} -> ${result.status}`)
})

server.listen(PORT, () => {
	console.log(`[mock-api] listening on http://localhost:${PORT} (CORS for ${STOREFRONT_ORIGIN})`)
})

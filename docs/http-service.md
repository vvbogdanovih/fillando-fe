# HTTP Service

`src/common/services/http.service.ts`

Axios-based singleton (`httpService`) used for all API communication. Wraps every response through optional Zod validation and handles token refresh automatically.

---

## Usage

```ts
import { httpService } from '@/common/services/http.service'

// Without validation
const data = await httpService.get('/some/endpoint')

// With Zod schema — response is validated and typed automatically
const data = await httpService.get('/some/endpoint', { schema: mySchema })

// Suppress the automatic error toast for a specific call
const data = await httpService.post('/some/endpoint', body, { skipErrorToast: true })
```

---

## Config type

```ts
type Config<T = unknown, D = unknown> = AxiosRequestConfig<D> & {
	schema?: z.ZodType<T> // Optional Zod schema to validate the response body
	skipErrorToast?: boolean // When true, errors are thrown but not shown in a toast
}
```

**`schema`** — If provided, the response body is run through `schema.parseAsync()`. On a Zod parse failure the error is toasted and re-thrown. Use this on every call where the response shape matters.

**`skipErrorToast`** — Use when the caller handles the error itself (e.g. a form that sets a field-level error) and the automatic toast would be redundant or confusing.

---

## Token refresh & deduplication

When any request returns `401`, the interceptor:

1. Marks the original request with `_retry = true` (prevents infinite loops).
2. Checks if a refresh is already in-flight (`refreshPromise` module-level singleton).
   If not, starts one and stores the promise. If one is already running, awaits the same promise.
   This ensures that N concurrent 401s trigger exactly one `/auth/refresh` call.
3. If refresh succeeds, retries the original request with the updated cookie.
4. If refresh fails, calls `logOut()` and returns `false`.

The `refreshPromise` variable is reset to `null` in the `.finally()` of every refresh attempt so the next 401 (in a future request cycle) starts a fresh refresh.

---

## Why native `fetch` in `refreshToken()`

`refreshToken()` is called from the Axios response interceptor. Using `apiClient` (Axios) inside the interceptor would cause the interceptor to trigger again on the refresh request, creating an infinite loop. Native `fetch` bypasses Axios entirely and avoids this.

---

## Zod validation failure behaviour

If schema validation fails:

- The error message is extracted from `ZodError.issues`.
- A toast is shown (not suppressed by `skipErrorToast`).
- An `Error` is thrown, rejecting the caller's promise.

This means a schema mismatch between frontend and backend is surfaced immediately as a visible error rather than silently producing `undefined` fields.

---

## Query parameter serialisation

The `get()` method serialises non-primitive query param values (objects, arrays) as JSON strings via `encodeURIComponent(JSON.stringify(value))`. The backend must expect this format.

---

## Blob / file downloads

Endpoints that return a binary body (PDF price list, order report, invoice) **must not** go through
`httpService`. Every `httpService` verb pipes the response through `handleAxiosResponse`, which runs
Zod `parseAsync` over the body — that destroys a blob.

Use bare `axios` with the base URL and credentials supplied explicitly:

```ts
const response = await axios.post(`${API_BASE_URL}${API_URLS.PRODUCTS.PRICE_LIST_PDF}`, payload, {
	responseType: 'blob',
	withCredentials: true
})
```

Two consequences of bypassing the interceptor, both of which the caller must handle:

1. **No automatic error toast.** `skipErrorToast` is irrelevant here — nothing toasts at all. Handle
   errors explicitly in the mutation's `onError`. A failed request still returns a JSON body, so read
   it off the blob (`await blob.text()` → `JSON.parse`) to surface the real server message; guard on
   `blob.type` not containing `pdf` to detect that case.
2. **No 401 → `/auth/refresh` → retry.** If the access token expired since the last `httpService`
   call the download simply fails and the user must retry. A shared `downloadBlob` helper that
   refreshes once on 401 would fix this for all three call sites — not done yet.

Do **not** wrap the response in `new Blob([response.data])`. `response.data` is already a `Blob`, and
re-wrapping drops its MIME type, which breaks both the content-type guard above and the browser's
preview handling.

### Reading the server filename requires CORS

The frontend and API are different origins, so the browser hides every non-safelisted response header
from JS. `Content-Disposition` is only readable because the backend sends
`Access-Control-Expose-Headers: Content-Disposition` (`fillando-be/src/main.ts`). Without it the
filename parse silently falls back to a generic name — the download still works, it is just named
wrong, which makes this an easy regression to miss.

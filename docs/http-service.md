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

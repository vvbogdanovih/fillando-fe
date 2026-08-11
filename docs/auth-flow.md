# Auth Flow

End-to-end documentation of all authentication paths in the app.

---

## 1. App boot

```
Browser loads app
  → Providers mounts (src/app/provider.tsx)
  → useEffect (runs once, after mount):
      → useAuthStore.persist.rehydrate()  ← apply persisted user now
      → useCartStore.persist.rehydrate()  ← apply persisted guest cart now
      → useAuthStore.getState().checkAuth()
          → hits GET /auth/me with current cookies
              ├─ 200: sets user (+ isAuthChecked=true) in Zustand store
              └─ any error: sets user = null (+ isAuthChecked=true)
          → on logged-in: useCartStore.fetchCart()
```

Children render immediately (no boot-time loader gate) so the server-rendered HTML stays visible to crawlers; routes that need the auth result wait on `isAuthChecked`.

### Why rehydrate manually (skipHydration)

Both persisted stores set `skipHydration: true`, so on the **first** client render they hold their initial (empty) state — matching the server-rendered HTML. The persisted values are applied only after mount, via the `persist.rehydrate()` calls above.

Without this, Zustand's default synchronous `localStorage` rehydration made the first client render diverge from the server (the Header flipping between the "Увійти" link and the account dropdown, the cart badge appearing). That structural difference also shifted Radix's `useId` sequence and produced `aria-controls` hydration mismatches. Any new `persist` store must follow the same pattern: `skipHydration: true` + a `rehydrate()` call in `Providers`.

> Note: `bis_skin_checked="1"` attribute diffs in hydration warnings come from the Bitdefender browser extension, not the app — verify real fixes in an incognito window.

---

## 2. Login / Register

```
User submits form
  → React Hook Form validates with Zod (client-side)
  → useMutation calls authApi.login() / authApi.register()
  → httpService.post() → POST /auth/login or /auth/register
  → Server sets HttpOnly cookie, returns { message, user }
  → authResponseSchema validates the response
  → onSuccess: useAuthStore.setUser(data.user)
  → AuthLayout's useEffect detects user is now set → redirect to HOME
```

---

## 3. Google OAuth

```
User clicks "Увійти через Google" button
  → window.location.href = API_BASE_URL + /auth/google
  → Backend redirects to Google consent screen
  → Google redirects back to backend callback URL
  → Backend sets cookie, redirects to /auth/success
```

### /auth/success page (`src/app/auth/success/page.tsx`)

```
AuthSuccessPage mounts
  → useEffect starts checkAuth(), sets cancelled = false
  → checkAuth() hits GET /auth/me
  → On resolve: if cancelled is still false, setIsChecking(false)
  → Second useEffect fires when isChecking becomes false
  → Reads current user from store snapshot (not reactive)
  → router.replace(HOME) if user exists, else router.replace(LOGIN)
```

**Why the `cancelled` flag?** React Strict Mode and fast navigation can cause the component to unmount before `checkAuth()` resolves. Without this flag, `setIsChecking(false)` would fire on an unmounted component, causing a state update warning and a possible stale redirect.

---

## 4. Auth layout guard (`src/app/auth/layout.tsx`)

Wraps all `/auth/*` routes. Reactively watches the Zustand `user` value. If a user is already logged in (e.g. navigates directly to `/auth/login`), they are immediately redirected to HOME via `router.replace`. This runs after the boot-time `checkAuth()` has hydrated the store.

---

## 5. Logout

```
User triggers logout (e.g. button calls useAuthStore.logOut())
  → POST /auth/logout (cookie cleared server-side)
  → finally block: set({ user: null })  ← always clears local state
```

The `finally` block is intentional: even if the API call fails (network error, server down), the local session is cleared so the user is not stuck in a logged-in UI state with an invalid cookie.

---

## 6. Token refresh (silent, mid-session)

See [http-service.md](./http-service.md#token-refresh--deduplication) for the full refresh flow.

```
Any API call returns 401
  → httpService interceptor catches it
  → POST /auth/refresh (native fetch, not Axios)
  → On success: cookie updated, original request retried
  → On failure: logOut() called → user = null → app redirects to login
```

---

## Store persistence

`useAuthStore` persists only `user` to `localStorage` under the key `auth-storage`. `isAuthChecked` is intentionally not persisted — it resets to `false` on every page load and is only set to `true` after `checkAuth()` completes.

Both `useAuthStore` (`auth-storage`) and `useCartStore` (`fillando-cart`) use `skipHydration: true` and are rehydrated manually from `Providers` on mount — see [Why rehydrate manually](#why-rehydrate-manually-skiphydration) under App boot.

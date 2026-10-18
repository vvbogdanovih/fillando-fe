# Auth Flow

End-to-end documentation of all authentication paths in the app.

---

## 1. App boot

```
Browser loads app
  → Providers mounts (src/app/provider.tsx)
  → useEffect (runs once, after mount):
      → startCrossTabSync()              ← see § Several tabs; subscribed BEFORE rehydrate
      → useAuthStore.persist.rehydrate()  ← apply persisted user now
      → useCartStore.persist.rehydrate()  ← apply persisted guest cart now
      → useAuthStore.getState().checkAuth()
          → hits GET /auth/me with current cookies
              ├─ 200: sets user (+ isAuthChecked=true) in Zustand store
              ├─ 401 (access JWT expired, refresh cookie alive): interceptor refreshes, retries
              └─ any error: sets user = null (+ isAuthChecked=true)
```

The server cart is **not** loaded from this effect. The cross-tab sync subscribes to the auth store and calls `fetchCart()` whenever `user` goes from `null` to a user — which the `rehydrate()` above triggers for a returning visitor, `checkAuth()` for a fresh one, and a login (here or in another tab) later on.

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

`logOut()` is for a logout the **user** asked for. A failed token refresh signs out locally only (`setUser(null)`) and never calls this — see § 6.

---

## 6. Token refresh (silent, mid-session)

See [http-service.md](./http-service.md#token-refresh--deduplication) for the full refresh flow.

```
Any API call returns 401
  → httpService interceptor catches it
  → POST /auth/refresh (native fetch, not Axios)
  → On success: cookies rotated, original request retried
  → On failure: setUser(null) locally — the backend's 401 already cleared the cookies —
                then the original request is still retried once (a guest-friendly route
                such as /auth/me now answers as for a guest; a protected one answers 401
                again and that error is final)
```

**Why not `logOut()` on failure.** `POST /auth/logout` revokes whatever refresh cookie the jar holds *at that moment*. Two tabs that meet an expired access token together both send the same refresh cookie; the backend keeps a 30 s reuse window for exactly that race, but when a refresh does fail, a server logout here would carry the other tab's freshly rotated token and revoke the session for every tab. The failed refresh has already told the backend to clear the cookies; nothing is left to revoke.

---

## 7. Several tabs (`src/common/store/cross-tab-sync.ts`)

Cookies are shared by every tab of a profile, but each tab's Zustand state is its own. `startCrossTabSync()`, started from `Providers` before the stores are rehydrated, keeps the tabs consistent with three signals:

| Signal | Reaction |
|---|---|
| `storage` event for `auth-storage` (another tab logged in or out) | `useAuthStore.persist.rehydrate()` — this tab now has that user (or `null`) |
| `storage` event for `fillando-cart` (another tab changed the guest cart) | `useCartStore.persist.rehydrate()` — no more stale tab overwriting the other tab's items on its next `set()` |
| `user` crosses `null` in this store (boot rehydrate, login, `/auth/me`, or either of the above) | `null → user`: `fetchCart()`; `user → null`: `resetServerCart()` |
| tab becomes `visible` while logged in | `fetchCart({ silent: true })` — the server cart may have changed in another tab; `silent` keeps `isLoading` untouched so `/checkout` does not flash its loader |

Nothing is written to `localStorage` by the sync itself, so tabs cannot echo each other; the `storage` event fires only in the tabs that did **not** write. The server cart is re-read, never pushed between tabs — a stale tab must not be able to overwrite the server's answer.

---

## Store persistence

`useAuthStore` persists only `user` to `localStorage` under the key `auth-storage`. `isAuthChecked` is intentionally not persisted — it resets to `false` on every page load and is only set to `true` after `checkAuth()` completes.

Both `useAuthStore` (`auth-storage`) and `useCartStore` (`fillando-cart`) use `skipHydration: true` and are rehydrated manually from `Providers` on mount — see [Why rehydrate manually](#why-rehydrate-manually-skiphydration) under App boot.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start dev server on port 9000
yarn build      # Build for production
yarn start      # Start production server
```

Use **Yarn** (not npm or bun). No test runner is configured yet.

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand, React Query, React Hook Form + Zod, Axios, Radix UI.

**Path alias:** `@/*` → `src/*`

### Directory Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── (root)/           # Main app routes
│   ├── auth/             # Auth routes (login, register, success)
│   │   ├── AuthForm.tsx  # Shared auth form shell (title, submit, Google OAuth)
│   │   ├── auth.api.ts   # Auth API calls
│   │   ├── auth.schema.ts
│   │   └── error.tsx     # Auth-segment error boundary
│   ├── error.tsx         # Root error boundary
│   ├── layout.tsx        # Root layout (light theme; Inter + Geist fonts)
│   └── provider.tsx      # Client providers (React Query, Toast) + auth init gate
├── env.ts                # Zod-validated env vars (throws on missing/invalid)
└── common/
    ├── components/
    │   ├── ui/           # Styled primitives (Button, Input, Card, Badge, PasswordInput, etc.)
    │   └── guards/       # PrivateRoute for role-based access control
    ├── constants/        # API_URLS, UI_URLS, Role enum, FORM_ERRORS
    ├── schemas/          # Zod schemas (composable primitives: email, password, name)
    ├── services/
    │   └── http.service.ts  # Axios singleton with interceptors + token refresh
    ├── store/
    │   └── useAuthStore.ts  # Zustand auth store (persists to localStorage)
    ├── types/
    └── utils/
        └── shad-cn.utils.ts  # cn() class merging utility
```

### Key Patterns

**HTTP Service:** `httpService` is an Axios singleton. Every call accepts an optional Zod schema to validate the response. 401s trigger automatic token refresh with promise deduplication.

**Auth Flow:** App boot → `checkAuth()` hits `/auth/me` → Zustand hydrates → `<FullScreenLoader>` unmounts → render. Login/register → Zod validates response → Zustand store updates → cookie-based session. `PrivateRoute` wraps protected pages and checks `useAuthStore`. See `docs/auth-flow.md` for the full breakdown.

**Forms:** React Hook Form + `zodResolver`. Schemas live in feature-level `*.schema.ts` files and reuse primitives from `common/schemas/`.

**UI Components:** Follow shadcn/ui conventions but are custom-built. Use CVA for variants. Radix UI headless primitives (Slider, Switch, Dialog, etc.) are styled with Tailwind.

**Routing constants:** All frontend routes are in `common/constants/ui-routes.constants.ts`. All API endpoint paths are in `common/constants/api-routes.constants.ts`. Always use these rather than hardcoding strings.

**Orders admin flow:** `/admin/orders` loads paginated order list with `order_status` and `payment_status` filters via `GET /orders`. `/admin/orders/[id]` loads details via `GET /orders/:id` and supports full edit with `PATCH /orders/:id` plus quick updates via `PATCH /orders/:id/status`, `PATCH /orders/:id/payment-status`, `PATCH /orders/:id/ttn`.

**Styling:** Tailwind CSS 4 with `@theme` inline tokens in `globals.css` (no `tailwind.config.*`). The site renders in a **single light theme** (`:root` tokens; there is no `.dark` block and `<html>` carries no theme class). Custom design tokens include filament-type colors (PLA, PETG, ABS, TPU, Nylon), gradients (`--gradient-primary/accent/border`), glow shadows, and utilities like `gradient-text`, `card-hover`, `glow-primary`, `animate-float`, `gradient-border`.

**Motion / smooth scroll:** `motion` (Framer, `motion/react`) + `lenis` power storefront animations. Reusable primitives live in `common/components/motion/` (`SmoothScrollProvider`, `ScrollReveal`, `StaggerGroup`/`StaggerItem`, `Parallax`, `MagneticButton`) — all `'use client'`. `SmoothScrollProvider` is mounted in `(root)/layout.tsx` only (admin/auth keep native scroll) and wraps the tree in `<MotionConfig reducedMotion='user'>`; under `prefers-reduced-motion` Lenis is skipped entirely. Radix dialogs/drawers pause Lenis via the `useLenisModalLock` hook (`common/hooks/`) plus `data-lenis-prevent` on their inner scroll containers. Guardrails: never parallax large rasters or the LCP hero; keep GPU-only transforms (translate/scale/opacity).

**Formatting:** Prettier with tabs (width 4), single quotes, no trailing commas, print width 100, Tailwind class sorting.

## Documentation & Flow Integrity

Before marking a task done, check whether the changes affect any documented flow, API contract, or data structure.

- **If a documented flow changes** (auth, HTTP service, routing, store shape), update the relevant section in this file or in `/docs` before closing the task.
- **If a new flow is introduced** and no documentation exists for it, suggest creating a new file under `/docs` (e.g. `/docs/auth-flow.md`).
- **Inline comments** are required only where the logic is non-obvious — don't annotate self-evident code.

The rule: a task that changes behaviour is not done until the documentation reflects the new reality.

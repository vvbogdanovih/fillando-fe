import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// `findBy…` / `waitFor` give up after one second by default. The whole suite runs in parallel
// workers, and on a busy machine a mocked request plus a re-render does not always fit into it:
// `TypedProductList` kept failing «Unable to find … Товар 51» in the full run while passing alone
// (Plan-0010 P28, audit 2026-11-15). A wait that succeeds returns as soon as it can, so a longer
// limit costs nothing where the test passes.
configure({ asyncUtilTimeout: 3000 })

// jsdom has no ResizeObserver; Radix Slider (via `useSize`) calls it on mount, so any component
// that renders `PriceRangeFilter` would throw. Layout never happens in jsdom — a no-op is exact.
if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

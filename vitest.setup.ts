import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; Radix Slider (via `useSize`) calls it on mount, so any component
// that renders `PriceRangeFilter` would throw. Layout never happens in jsdom — a no-op is exact.
if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

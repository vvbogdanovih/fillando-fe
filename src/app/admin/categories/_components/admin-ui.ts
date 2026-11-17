import { buttonVariants } from '@/common/components/ui/button'
import { fieldClassName } from '@/common/components/ui/input'
import { cn } from '@/common/utils/shad-cn.utils'

/**
 * The look of the catalogue admin panels: white cards on the admin's muted background, one
 * heading per card, inputs sized to their content's column, the shared button variants. Native
 * `<select>`/`<input>` stay — Playwright's `selectOption` and `fireEvent.change` need them.
 */
export const ui = {
	card: 'min-w-0 space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm',
	cardTitle: 'text-base font-semibold text-gray-900',
	sectionTitle: 'text-xs font-semibold tracking-wide text-gray-500 uppercase',
	hint: 'text-sm text-gray-500',
	label: 'block min-w-0 text-sm font-medium text-gray-700',
	/** Text fields and selects look like the rest of the admin's `Input` (owner, 2026-11-09). */
	field: cn(fieldClassName, 'h-10 min-w-0 font-normal'),
	input: cn(fieldClassName, 'mt-1 h-10 min-w-0 font-normal'),
	textarea: cn(fieldClassName, 'mt-1 min-h-20 min-w-0 font-normal'),
	button: buttonVariants({ variant: 'outline', size: 'sm' }),
	primary: buttonVariants({ variant: 'default', size: 'sm' }),
	badge: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
	/** ↑ ↓ × beside a row: order by arrows, never typed numbers (owner, 2026-11-07). */
	arrow: 'inline-flex size-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30'
}

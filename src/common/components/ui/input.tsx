import * as React from 'react'

import { cn } from '@/common/utils/shad-cn.utils'

/**
 * The one look of a text field (owner, 2026-11-09): `Input` itself, and the native `<select>` and
 * `<textarea>` of the catalogue admin (`admin-ui.ts`) — never a look of their own.
 */
export const fieldClassName =
	'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 aria-invalid:border-destructive'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot='input'
			className={cn(
				fieldClassName,
				'file:text-foreground flex h-10 file:border-0 file:bg-transparent file:text-sm file:font-medium',
				className
			)}
			{...props}
		/>
	)
}

export { Input }

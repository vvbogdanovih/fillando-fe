'use client'

import * as React from 'react'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput
} from '@/common/components/ui/input-group'

interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
	error?: boolean
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
	({ error, ...props }, ref) => {
		const [show, setShow] = useState(false)

		return (
			<InputGroup>
				<InputGroupInput
					type={show ? 'text' : 'password'}
					aria-invalid={error}
					ref={ref}
					{...props}
				/>
				<InputGroupAddon align='inline-end'>
					<InputGroupButton
						size='icon-xs'
						onClick={() => setShow(v => !v)}
						aria-label={show ? 'Hide password' : 'Show password'}
					>
						{show ? <EyeOff /> : <Eye />}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		)
	}
)
PasswordInput.displayName = 'PasswordInput'

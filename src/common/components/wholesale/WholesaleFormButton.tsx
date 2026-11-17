'use client'

import { useState, type ReactNode } from 'react'
import { useLenisModalLock } from '@/common/hooks/useLenisModalLock'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/common/components/ui/dialog'
import { WholesaleInquiryForm } from './WholesaleInquiryForm'

/** A button that opens the wholesale inquiry form in a dialog (the home page's side card). */
export function WholesaleFormButton({
	className,
	children
}: {
	className?: string
	children: ReactNode
}) {
	const [open, setOpen] = useState(false)
	// Pause Lenis while the inquiry dialog is open.
	useLenisModalLock(open)
	return (
		<>
			<button type='button' className={className} onClick={() => setOpen(true)}>
				{children}
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Заявка на оптову закупку</DialogTitle>
						<DialogDescription>
							Залиште контакти — ми зв&apos;яжемося з вами та запропонуємо
							індивідуальні умови.
						</DialogDescription>
					</DialogHeader>
					<WholesaleInquiryForm onSuccess={() => setOpen(false)} />
				</DialogContent>
			</Dialog>
		</>
	)
}

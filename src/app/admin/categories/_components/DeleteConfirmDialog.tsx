'use client'

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter
} from '@/common/components/ui/dialog'
import { Button } from '@/common/components/ui/button'

interface DeleteConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	onConfirm: () => void
	isPending?: boolean
}

export const DeleteConfirmDialog = ({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	isPending
}: DeleteConfirmDialogProps) => {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant='outline'
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Скасувати
					</Button>
					<Button variant='destructive' onClick={onConfirm} disabled={isPending}>
						{isPending ? 'Видалення...' : 'Видалити'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

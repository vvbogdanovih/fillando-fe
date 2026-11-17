import type { ReactNode } from 'react'
import type { CategoryCommand } from '../category-tree.api'
import type { TypedProduct } from '../typed-product.schema'
import { CategoryDraftsProvider, useCategorySave } from './category-drafts'
import { useProductSave } from './product-drafts'

/**
 * A block of the category page under test, with the header's «Зберегти» and «Скасувати» (owner,
 * 2026-11-09: the blocks hold no save buttons): «Зберегти» hands every prepared command to
 * `onSubmit`, as the header sends them, with `revision` as the expected one.
 */
export function WithDrafts({
	categoryId,
	revision,
	onSubmit,
	children
}: {
	categoryId: string
	revision: number
	onSubmit: (command: CategoryCommand) => void
	children: ReactNode
}) {
	return (
		<CategoryDraftsProvider>
			{children}
			<SaveButtons categoryId={categoryId} revision={revision} onSubmit={onSubmit} />
		</CategoryDraftsProvider>
	)
}

function SaveButtons({
	categoryId,
	revision,
	onSubmit
}: {
	categoryId: string
	revision: number
	onSubmit: (command: CategoryCommand) => void
}) {
	const save = useCategorySave(categoryId)
	return (
		<>
			<button
				type='button'
				disabled={!save.unsaved.length}
				onClick={() => {
					const commands = save.prepare(revision)
					// A block that cannot be sent: nothing goes, its issue is shown in it.
					if (Array.isArray(commands))
						commands.forEach(({ command }) => onSubmit(command))
				}}
			>
				Зберегти
			</button>
			<button type='button' disabled={!save.unsaved.length} onClick={() => save.discard()}>
				Скасувати
			</button>
		</>
	)
}

/**
 * A block of the product page under test, with the product header's «Зберегти» and «Скасувати»
 * (owner, 2026-11-09): «Зберегти» hands the one prepared command to `onSubmit`, as the header does.
 */
export function WithProductDrafts({
	product,
	disabled = false,
	onSubmit,
	children
}: {
	product: TypedProduct
	disabled?: boolean
	onSubmit: (command: CategoryCommand) => void
	children: ReactNode
}) {
	return (
		<CategoryDraftsProvider>
			{children}
			<ProductSaveButtons product={product} disabled={disabled} onSubmit={onSubmit} />
		</CategoryDraftsProvider>
	)
}

function ProductSaveButtons({
	product,
	disabled,
	onSubmit
}: {
	product: TypedProduct
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const save = useProductSave(product)
	return (
		<>
			<button
				type='button'
				disabled={disabled || !save.unsaved.length}
				onClick={() => {
					const command = save.prepare()
					if (command) onSubmit(command)
				}}
			>
				Зберегти
			</button>
			<button type='button' disabled={!save.unsaved.length} onClick={save.discard}>
				Скасувати
			</button>
		</>
	)
}

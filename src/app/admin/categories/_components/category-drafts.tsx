'use client'
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react'
import type { CategoryCommand } from '../category-tree.api'
import { definitionsInputSchema, type DefinitionInput } from '../category-definitions.schema'
import type { CategorySeo } from '../category-seo.schema'

/**
 * Unsaved edits of the category and product pages (owner, 2026-11-09: one «Зберегти» in the page's
 * header instead of a save button per block). They live above the blocks, not in them: a block
 * remounts on every new revision, a folded block unmounts, and a refused save must keep what the
 * admin typed — so a block shows its draft when there is one, the server value otherwise. A scope is
 * a category id, or `product:<id>` (`productScope`).
 */
export type DraftSection = 'details' | 'move' | 'definitions' | 'seo' | 'export'

/** The blocks in page order, with the name the header lists an unsaved one by. */
export const DRAFT_SECTIONS: { id: DraftSection; label: string }[] = [
	{ id: 'details', label: 'Назва й зображення' },
	{ id: 'move', label: 'Розташування' },
	{ id: 'definitions', label: 'Характеристики' },
	{ id: 'seo', label: 'Сторінка категорії на сайті' },
	{ id: 'export', label: 'Google Shopping' }
]

export interface DetailsDraft {
	name: string
	image: string | null
}
export interface MoveDraft {
	parent: string
	order: string
}
export type SeoDraft = Record<'title' | 'description' | 'h1' | 'intro_html' | 'bottom_html', string>
export interface ExportDraft {
	id: string
	path: string
}

/** Why a block cannot be saved as it is; `rows` are the characteristics an issue names. */
export interface DraftIssue {
	message: string
	rows?: number[]
}

interface Draft {
	value: unknown
	/** The server value the draft was made from: what «changed» is measured against. */
	base: unknown
}
type Drafts = Record<string, Record<string, Draft>>
type Issues = Record<string, Record<string, DraftIssue>>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const DraftsContext = createContext<{
	drafts: Drafts
	issues: Issues
	set: (
		scope: string,
		section: string,
		next: unknown | ((previous: unknown) => unknown),
		base: unknown
	) => void
	clear: (scope: string, sections?: string[]) => void
	settle: (command: CategoryCommand) => void
	setIssue: (scope: string, section: string, issue: DraftIssue | null) => void
} | null>(null)

export function CategoryDraftsProvider({ children }: { children: ReactNode }) {
	const [drafts, setDrafts] = useState<Drafts>({})
	const [issues, setIssues] = useState<Issues>({})
	const set = useCallback(
		(
			categoryId: string,
			section: string,
			next: unknown | ((previous: unknown) => unknown),
			base: unknown
		) =>
			setDrafts(previous => {
				const own = { ...previous[categoryId] }
				// An updater sees the latest draft, not the render's: two updates in one event add up.
				const current = own[section] ? own[section].value : base
				const value = typeof next === 'function' ? next(current) : next
				// Back to the server value: nothing is unsaved any more.
				if (same(value, base)) delete own[section]
				else own[section] = { value, base }
				return { ...previous, [categoryId]: own }
			}),
		[]
	)
	const setIssue = useCallback(
		(categoryId: string, section: string, issue: DraftIssue | null) =>
			setIssues(previous => {
				const own = { ...previous[categoryId] }
				if (issue) own[section] = issue
				else delete own[section]
				return { ...previous, [categoryId]: own }
			}),
		[]
	)
	const clear = useCallback((categoryId: string, sections?: string[]) => {
		const drop = <T,>(previous: Record<string, Record<string, T>>) => {
			const own = { ...previous[categoryId] }
			for (const section of sections ?? Object.keys(own)) delete own[section]
			return { ...previous, [categoryId]: own }
		}
		setDrafts(drop)
		setIssues(drop)
	}, [])
	// A confirmed command settles its block only while the draft is still what was sent: an edit
	// made while the request was on its way stays unsaved.
	const settle = useCallback(
		(command: CategoryCommand) => {
			if (!isSectionCommand(command)) return
			setDrafts(previous => {
				const draft = previous[command.id]?.[command.type]
				if (
					!draft ||
					!same(
						sectionCommand(
							command.id,
							command.type,
							draft,
							command.body.expected_revision
						),
						command
					)
				)
					return previous
				const own = { ...previous[command.id] }
				delete own[command.type]
				return { ...previous, [command.id]: own }
			})
			setIssue(command.id, command.type, null)
		},
		[setIssue]
	)
	const value = useMemo(
		() => ({ drafts, issues, set, clear, settle, setIssue }),
		[drafts, issues, set, clear, settle, setIssue]
	)
	return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>
}

function useDrafts() {
	const context = useContext(DraftsContext)
	if (!context) throw new Error('CategoryDraftsProvider is missing')
	return context
}

/**
 * A block's editable value: its draft, or the server value `base` while there is none. Setting it
 * back to `base` removes the draft. Editing clears the block's issue — it was about the old value.
 */
export function useCategoryDraft<T>(
	categoryId: string,
	section: string,
	base: T
): [T, (next: T | ((previous: T) => T)) => void, boolean] {
	const { drafts, set, setIssue, clear } = useDrafts()
	const draft = drafts[categoryId]?.[section]
	const value = (draft ? draft.value : base) as T
	// The server has caught up with the draft (an operation confirmed after a lost answer, or the
	// same edit made elsewhere): nothing is unsaved any more.
	const caughtUp = !!draft && same(draft.value, base)
	useEffect(() => {
		if (caughtUp) clear(categoryId, [section])
	}, [caughtUp, categoryId, section, clear])
	const update = (next: T | ((previous: T) => T)) => {
		set(categoryId, section, next, base)
		setIssue(categoryId, section, null)
	}
	return [value, update, !!draft]
}

export function useDraftIssue(categoryId: string, section: string) {
	return useDrafts().issues[categoryId]?.[section] ?? null
}

/** The draft store of one scope, for a page header that builds and sends it. */
export function useDraftScope(scope: string | null) {
	const { drafts, clear, setIssue } = useDrafts()
	return {
		drafts: (scope && drafts[scope]) || {},
		clear: (sections?: string[]) => scope && clear(scope, sections),
		setIssue: (section: string, issue: DraftIssue | null) =>
			scope && setIssue(scope, section, issue)
	}
}

/** Scopes with unsaved edits: the tree's and the product list's marks, the leave-page warning. */
export function useDirtyScopes() {
	const { drafts } = useDrafts()
	return Object.keys(drafts).filter(scope => Object.keys(drafts[scope]).length > 0)
}

export const productScope = (productId: string) => `product:${productId}`

/** The header's side: what is unsaved, the commands to send, and dropping the drafts. */
export function useCategorySave(categoryId: string | null) {
	const { drafts, clear, settle, setIssue } = useDrafts()
	const own = (categoryId && drafts[categoryId]) || {}
	const unsaved = DRAFT_SECTIONS.filter(section => own[section.id])
	/**
	 * Every unsaved block's command, or — when one cannot be sent as it is — `refused`: the blocks
	 * and why. Their issues are then shown in them and nothing is sent at all (the header names
	 * them: a block may be folded or far down the page). `expected_revision` is the caller's to
	 * replace for each command in turn.
	 */
	const prepare = (revision: number) => {
		if (!categoryId) return null
		const commands: { section: DraftSection; label: string; command: CategoryCommand }[] = []
		const refused: { label: string; message: string }[] = []
		for (const section of unsaved) {
			const draft = own[section.id]!
			const result = sectionCommand(categoryId, section.id, draft, revision)
			if ('issue' in result) {
				setIssue(categoryId, section.id, result.issue)
				refused.push({ label: section.label, message: result.issue.message })
			} else commands.push({ section: section.id, label: section.label, command: result })
		}
		return refused.length ? { refused } : commands
	}
	return {
		unsaved,
		prepare,
		/**
		 * After a block's command is confirmed (now, or later by its status or a retry): its draft is
		 * the server value — unless it was edited since the command was built.
		 */
		saved: settle,
		refused: (section: DraftSection, message: string) =>
			categoryId && setIssue(categoryId, section, { message }),
		/** Drops the category's unsaved edits — all, or the named blocks'. */
		discard: (sections?: DraftSection[]) => categoryId && clear(categoryId, sections),
		/** Scopes with unsaved edits — category ids and `product:<id>` (`useDirtyScopes`). */
		dirtyCategories: Object.keys(drafts).filter(id => Object.keys(drafts[id]).length > 0)
	}
}

type SectionCommand = Extract<CategoryCommand, { type: DraftSection }>
const isSectionCommand = (command: CategoryCommand): command is SectionCommand =>
	DRAFT_SECTIONS.some(section => section.id === command.type)

/** One block's draft as the command the server takes, or why it cannot be sent. */
function sectionCommand(
	categoryId: string,
	section: DraftSection,
	draft: Draft,
	revision: number
): CategoryCommand | { issue: DraftIssue } {
	switch (section) {
		case 'details': {
			const value = draft.value as DetailsDraft
			const base = draft.base as DetailsDraft
			if (!value.name.trim()) return { issue: { message: 'Вкажіть назву категорії.' } }
			return {
				type: 'details',
				id: categoryId,
				body: {
					name: value.name.trim(),
					...(value.image !== base.image ? { image: value.image } : {}),
					expected_revision: revision
				}
			}
		}
		case 'move': {
			const value = draft.value as MoveDraft
			const order = Number(value.order)
			if (value.order.trim() === '' || !Number.isSafeInteger(order) || order < 0)
				return { issue: { message: 'Порядок — ціле число від 0.' } }
			return {
				type: 'move',
				id: categoryId,
				body: { parent_id: value.parent || null, order, expected_revision: revision }
			}
		}
		case 'definitions': {
			const parsed = definitionsInputSchema.safeParse(draft.value as DefinitionInput[])
			if (!parsed.success)
				return {
					issue: {
						message: parsed.error.issues
							.map(issue => `${Number(issue.path[0]) + 1}: ${issue.message}`)
							.join('; '),
						rows: parsed.error.issues.map(issue => Number(issue.path[0]))
					}
				}
			return {
				type: 'definitions',
				id: categoryId,
				body: { expected_revision: revision, definitions: parsed.data }
			}
		}
		case 'seo':
			return {
				type: 'seo',
				id: categoryId,
				body: { expected_revision: revision, seo: seoValue(draft.value as SeoDraft) }
			}
		case 'export': {
			const value = draft.value as ExportDraft
			const id = value.id.trim()
			const path = value.path.trim()
			// A path left without its ID is half an edit, not «no category»: saving it as empty
			// would take the Google category off every product of the feed.
			if ((id || path) && (!/^\d+$/.test(id) || !path))
				return {
					issue: {
						message: 'Категорія Google: числовий ID і шлях разом, або обидва порожні.'
					}
				}
			return {
				type: 'export',
				id: categoryId,
				body: {
					expected_revision: revision,
					google_product_category: id ? { id: Number(id), path } : null
				}
			}
		}
	}
}

/** The SEO form's strings as stored: empty means «use the default», an empty editor is no text. */
export function seoValue(seo: SeoDraft): CategorySeo {
	return {
		title: seo.title.trim() || null,
		description: seo.description.trim() || null,
		h1: seo.h1.trim() || null,
		intro_html: seo.intro_html.replace(/<[^>]*>/g, '').trim() ? seo.intro_html : null,
		bottom_html: seo.bottom_html.replace(/<[^>]*>/g, '').trim() ? seo.bottom_html : null
	}
}

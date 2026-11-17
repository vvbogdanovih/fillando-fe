'use client'

import 'react-quill-new/dist/quill.snow.css'
import dynamic from 'next/dynamic'

// Quill touches `document` on import, so it can only load in the browser.
const QuillEditor = dynamic(() => import('react-quill-new'), {
	ssr: false,
	loading: () => (
		<div className='h-40 animate-pulse rounded-md border border-gray-200 bg-gray-50' />
	)
})

const TOOLBAR_OPTIONS = [
	[{ header: [2, 3, false] }],
	['bold', 'italic', 'underline'],
	[{ list: 'ordered' }, { list: 'bullet' }],
	['link'],
	['clean']
]

interface HtmlEditorProps {
	value: string
	onChange: (html: string) => void
	placeholder?: string
	/** A `<fieldset disabled>` does not stop typing in the editor: the form passes it its lock. */
	readOnly?: boolean
}

/**
 * Controlled rich-text field for landing copy.
 *
 * Whatever survives here is stored and later rendered with `dangerouslySetInnerHTML`, so the
 * backend sanitises it again on write — this toolbar is a convenience, never the security
 * boundary.
 */
/**
 * Quill writes `&nbsp;` for the spaces between words. The backend normalises them on write, but
 * doing it here too keeps the form state and the stored value identical — otherwise the field
 * comes back different from what was submitted, and the editor's own preview cannot wrap either.
 * A non-breaking space after a digit is the typographic kind («100 °C») and is left alone.
 */
const normalizeSpaces = (html: string) => html.replace(/(\D|^)\u00a0/g, '$1 ')

export const HtmlEditor = ({ value, onChange, placeholder, readOnly }: HtmlEditorProps) => {
	return (
		<QuillEditor
			theme='snow'
			value={value}
			readOnly={readOnly}
			// Only what the admin typed or formatted: Quill re-renders a loaded text on mount
			// («api»), and that is no edit — the category page would call it unsaved at once.
			onChange={(html, _delta, source) => {
				if (source === 'user') onChange(normalizeSpaces(html))
			}}
			placeholder={placeholder}
			modules={{ toolbar: TOOLBAR_OPTIONS }}
			className='bg-white [&_.ql-editor]:min-h-32'
		/>
	)
}

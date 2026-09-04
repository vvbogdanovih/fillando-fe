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
}

/**
 * Controlled rich-text field for landing copy.
 *
 * Whatever survives here is stored and later rendered with `dangerouslySetInnerHTML`, so the
 * backend sanitises it again on write — this toolbar is a convenience, never the security
 * boundary.
 */
export const HtmlEditor = ({ value, onChange, placeholder }: HtmlEditorProps) => {
	return (
		<QuillEditor
			theme='snow'
			value={value}
			onChange={onChange}
			placeholder={placeholder}
			modules={{ toolbar: TOOLBAR_OPTIONS }}
			className='bg-white [&_.ql-editor]:min-h-32'
		/>
	)
}

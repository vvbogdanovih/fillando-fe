'use client'

import 'react-quill-new/dist/quill.snow.css'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { MutableRefObject } from 'react'
import type ReactQuill from 'react-quill-new'

type UnprivilegedEditor = ReactQuill.UnprivilegedEditor

// SSR-safe dynamic import of Quill
const QuillEditor = dynamic(() => import('react-quill-new'), { ssr: false })

const TOOLBAR_OPTIONS = [
	[{ header: [2, 3, false] }],
	['bold', 'italic', 'underline'],
	[{ list: 'ordered' }, { list: 'bullet' }],
	['link'],
	['clean']
]

export interface DescriptionValue {
	html: string
	json: object
}

interface DescriptionBlockProps {
	// A ref the parent can read on submit; DescriptionBlock writes to it on every change
	descriptionRef: MutableRefObject<DescriptionValue | null>
	// Pre-populate the editor with existing content (used by edit form)
	initialValue?: DescriptionValue
}

export const DescriptionBlock = ({ descriptionRef, initialValue }: DescriptionBlockProps) => {
	const [value, setValue] = useState(initialValue?.html ?? '')

	// Initialize ref with existing content so save without edits still sends correct data
	useEffect(() => {
		if (initialValue) {
			descriptionRef.current = initialValue
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleChange = (
		html: string,
		_delta: unknown,
		_source: unknown,
		editor: UnprivilegedEditor
	) => {
		setValue(html)
		descriptionRef.current = { html, json: editor.getContents() as object }
	}

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<h2 className='text-sm font-semibold text-gray-900'>Опис</h2>
			<QuillEditor
				theme='snow'
				value={value}
				placeholder='Введіть опис продукту...'
				modules={{ toolbar: TOOLBAR_OPTIONS }}
				onChange={handleChange}
				className='rounded-md'
			/>
		</section>
	)
}

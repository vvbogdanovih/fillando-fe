import type { ReactNode } from 'react'

export interface LegalSection {
	heading?: string
	paragraphs?: ReactNode[]
	items?: ReactNode[]
}

interface LegalDocumentProps {
	kicker?: string
	title: string
	lead?: string
	updatedAt?: string
	sections: LegalSection[]
	footer?: ReactNode
}

/** Shared shell for static legal / informational pages (offer, returns, privacy). */
export function LegalDocument({
	kicker,
	title,
	lead,
	updatedAt,
	sections,
	footer
}: LegalDocumentProps) {
	return (
		<div className='container mx-auto max-w-3xl px-4 py-16'>
			<section className='mb-10 text-center'>
				{kicker && (
					<p className='text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase'>
						{kicker}
					</p>
				)}
				<h1 className='mb-4 text-4xl font-bold tracking-tight'>{title}</h1>
				{lead && <p className='text-muted-foreground mx-auto max-w-2xl text-lg'>{lead}</p>}
				{updatedAt && (
					<p className='text-muted-foreground mt-4 text-xs'>Редакція від {updatedAt}</p>
				)}
			</section>

			<article className='border-border bg-card flex flex-col gap-8 rounded-2xl border px-6 py-8 md:px-8'>
				{sections.map((section, i) => (
					<section key={section.heading ?? i} className='flex flex-col gap-3'>
						{section.heading && (
							<h2 className='text-lg font-semibold'>{section.heading}</h2>
						)}
						{section.paragraphs?.map((paragraph, j) => (
							<p key={j} className='text-muted-foreground leading-relaxed'>
								{paragraph}
							</p>
						))}
						{section.items && (
							<ul className='text-muted-foreground flex list-disc flex-col gap-2 pl-5 leading-relaxed'>
								{section.items.map((item, k) => (
									<li key={k}>{item}</li>
								))}
							</ul>
						)}
					</section>
				))}
				{footer}
			</article>
		</div>
	)
}

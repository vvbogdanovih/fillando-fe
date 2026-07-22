import type { Metadata } from 'next'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { CONTACTS } from '@/common/constants'
import { JsonLd } from '@/common/components/JsonLd'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent
} from '@/common/components/ui/accordion'
import { FAQ_SECTIONS } from './faq.constants'

export const metadata: Metadata = {
	title: 'Часті запитання',
	description:
		'Відповіді на часті запитання про замовлення, оплату, доставку Новою Поштою, повернення та зберігання філаменту для 3D-друку.'
}

const faqSchema = {
	'@context': 'https://schema.org',
	'@type': 'FAQPage',
	mainEntity: FAQ_SECTIONS.flatMap(section =>
		section.items.map(item => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer.join('\n\n') }
		}))
	)
}

export default function FaqPage() {
	return (
		<div className='container mx-auto max-w-3xl px-4 py-16'>
			<JsonLd data={faqSchema} />

			{/* Hero */}
			<section className='mb-12 text-center'>
				<p className='text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase'>
					FAQ
				</p>
				<h1 className='mb-4 text-4xl font-bold tracking-tight'>
					Часті <span className='gradient-text'>запитання</span>
				</h1>
				<p className='text-muted-foreground mx-auto max-w-2xl text-lg'>
					Все про замовлення, оплату, доставку та роботу з філаментом. Не знайшли
					відповіді? Напишіть нам — ми на зв’язку.
				</p>
			</section>

			{/* Sections */}
			<div className='flex flex-col gap-8'>
				{FAQ_SECTIONS.map(section => (
					<section
						key={section.title}
						className='border-border bg-card rounded-2xl border px-6 py-2 md:px-8'
					>
						<h2 className='border-border border-b py-4 text-lg font-semibold'>
							{section.title}
						</h2>
						<Accordion type='multiple'>
							{section.items.map(item => (
								<AccordionItem key={item.question} value={item.question}>
									<AccordionTrigger>{item.question}</AccordionTrigger>
									<AccordionContent className='text-muted-foreground flex flex-col gap-3'>
										{item.answer.map(paragraph => (
											<p key={paragraph}>{paragraph}</p>
										))}
										{item.link && (
											<Link
												href={item.link.href}
												className='text-primary font-medium hover:underline'
											>
												{item.link.label}
											</Link>
										)}
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</section>
				))}
			</div>

			{/* Contacts */}
			<section className='border-border bg-card mt-12 rounded-2xl border p-6 text-center md:p-8'>
				<h2 className='mb-2 text-2xl font-bold'>Залишилися питання?</h2>
				<p className='text-muted-foreground mb-6 text-sm'>
					Напишіть нам у месенджер або зателефонуйте — відповімо протягом робочого дня.
				</p>
				<div className='flex flex-wrap items-center justify-center gap-6'>
					<a
						href={`tel:${CONTACTS.PHONE}`}
						className='text-foreground hover:text-primary flex items-center gap-2 font-medium transition-colors'
					>
						<Phone className='size-4' />
						{CONTACTS.PHONE_DISPLAY}
					</a>
					<a
						href={CONTACTS.TELEGRAM_URL}
						target='_blank'
						rel='noopener noreferrer'
						className='text-foreground hover:text-primary flex items-center gap-2 font-medium transition-colors'
					>
						<TelegramIcon className='size-4' />
						Telegram
					</a>
					<a
						href={CONTACTS.VIBER_URL}
						target='_blank'
						rel='noopener noreferrer'
						className='text-foreground hover:text-primary flex items-center gap-2 font-medium transition-colors'
					>
						<ViberIcon className='size-4' />
						Viber
					</a>
				</div>
			</section>
		</div>
	)
}

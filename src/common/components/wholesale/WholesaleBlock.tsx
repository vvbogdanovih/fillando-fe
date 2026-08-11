'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Phone, Send } from 'lucide-react'
import { CONTACTS, UI_URLS } from '@/common/constants'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'
import { Button } from '@/common/components/ui/button'
import { ScrollReveal, MagneticButton } from '@/common/components/motion'
import { useLenisModalLock } from '@/common/hooks/useLenisModalLock'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/common/components/ui/dialog'
import { WholesaleInquiryForm } from './WholesaleInquiryForm'

export function WholesaleBlock() {
	const [formOpen, setFormOpen] = useState(false)

	// Pause Lenis while the inquiry dialog is open.
	useLenisModalLock(formOpen)

	return (
		<section className='py-8 md:py-12'>
			<p className='text-muted-foreground mb-6 text-xs font-semibold tracking-widest uppercase'>
				Співпраця
			</p>
			<ScrollReveal className='border-border bg-card relative overflow-hidden rounded-2xl border'>
				<div className='from-primary/10 absolute inset-0 bg-linear-to-br via-transparent to-transparent' />
				<div className='relative flex flex-col gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-12'>
					<div className='max-w-xl'>
						<h2 className='text-3xl font-bold tracking-tight'>
							Цікавить <span className='gradient-text'>оптова закупка</span> чи
							поставки спеціально для вас?
						</h2>
						<p className='text-muted-foreground mt-3 text-sm'>
							Зв&apos;яжіться з нами зручним способом або залиште заявку — і ми
							запропонуємо найкращі умови для вашого бізнесу.
						</p>
						<Link
							href={UI_URLS.WHOLESALE}
							className='text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80'
						>
							Детальніше про співпрацю
							<ArrowRight className='size-4' />
						</Link>
					</div>
					<div className='flex shrink-0 flex-col gap-3'>
						<MagneticButton className='w-fit self-center'>
							<Button size='lg' onClick={() => setFormOpen(true)}>
								<Send className='size-4' />
								Заповнити форму
							</Button>
						</MagneticButton>
						<div className='flex items-center justify-center gap-3'>
							<a
								href={`tel:${CONTACTS.PHONE}`}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
							>
								<Phone className='size-4' />
								{CONTACTS.PHONE_DISPLAY}
							</a>
						</div>
						<div className='flex items-center justify-center gap-3'>
							<a
								href={CONTACTS.VIBER_URL}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
								target='_blank'
								rel='noopener noreferrer'
							>
								<ViberIcon className='size-4' />
								Viber
							</a>
							<span className='text-muted-foreground/40'>|</span>
							<a
								href={CONTACTS.TELEGRAM_URL}
								className='text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors'
								target='_blank'
								rel='noopener noreferrer'
							>
								<TelegramIcon className='size-4' />
								Telegram
							</a>
						</div>
					</div>
				</div>
			</ScrollReveal>

			<Dialog open={formOpen} onOpenChange={setFormOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Заявка на оптову закупку</DialogTitle>
						<DialogDescription>
							Залиште контакти — ми зв&apos;яжемося з вами та запропонуємо
							індивідуальні умови.
						</DialogDescription>
					</DialogHeader>
					<WholesaleInquiryForm onSuccess={() => setFormOpen(false)} />
				</DialogContent>
			</Dialog>
		</section>
	)
}

import type { Metadata } from 'next'
import { Building2, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { COMPANY, CONTACTS } from '@/common/constants'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'

export const metadata: Metadata = {
	title: 'Контакти',
	description:
		'Контактні дані Fillando: телефон, email, месенджери, реквізити продавця та графік роботи служби підтримки.'
}

const requisites = [
	{ icon: Building2, label: 'Продавець', value: COMPANY.ENTITY },
	{ icon: Building2, label: COMPANY.TAX_ID_LABEL, value: COMPANY.TAX_ID },
	{ icon: MapPin, label: 'Адреса', value: COMPANY.ADDRESS },
	{ icon: Clock, label: 'Графік роботи', value: COMPANY.WORKING_HOURS }
]

export default function ContactsPage() {
	return (
		<div className='container mx-auto max-w-3xl px-4 py-16'>
			<section className='mb-12 text-center'>
				<p className='text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase'>
					Контакти
				</p>
				<h1 className='mb-4 text-4xl font-bold tracking-tight'>
					Зв’яжіться з <span className='gradient-text'>нами</span>
				</h1>
				<p className='text-muted-foreground mx-auto max-w-2xl text-lg'>
					Маєте питання щодо замовлення, оплати чи доставки? Напишіть або зателефонуйте —
					відповімо протягом робочого дня.
				</p>
			</section>

			{/* Способи зв'язку */}
			<section className='border-border bg-card rounded-2xl border p-6 md:p-8'>
				<h2 className='mb-4 text-lg font-semibold'>Служба підтримки</h2>
				<div className='flex flex-col gap-4'>
					<a
						href={`tel:${CONTACTS.PHONE}`}
						className='text-foreground hover:text-primary flex items-center gap-3 font-medium transition-colors'
					>
						<Phone className='text-primary size-5 shrink-0' />
						{CONTACTS.PHONE_DISPLAY}
					</a>
					<a
						href={`mailto:${CONTACTS.EMAIL}`}
						className='text-foreground hover:text-primary flex items-center gap-3 font-medium transition-colors'
					>
						<Mail className='text-primary size-5 shrink-0' />
						{CONTACTS.EMAIL}
					</a>
					<div className='flex flex-wrap items-center gap-6'>
						<a
							href={CONTACTS.TELEGRAM_URL}
							target='_blank'
							rel='noopener noreferrer'
							className='text-foreground hover:text-primary flex items-center gap-2 font-medium transition-colors'
						>
							<TelegramIcon className='size-5' />
							Telegram
						</a>
						<a
							href={CONTACTS.VIBER_URL}
							target='_blank'
							rel='noopener noreferrer'
							className='text-foreground hover:text-primary flex items-center gap-2 font-medium transition-colors'
						>
							<ViberIcon className='size-5' />
							Viber
						</a>
					</div>
				</div>
			</section>

			{/* Реквізити продавця */}
			<section className='border-border bg-card mt-8 rounded-2xl border p-6 md:p-8'>
				<h2 className='mb-4 text-lg font-semibold'>Реквізити продавця</h2>
				<dl className='flex flex-col gap-4'>
					{requisites.map(({ icon: Icon, label, value }) => (
						<div key={label} className='flex items-start gap-3'>
							<Icon className='text-muted-foreground mt-0.5 size-5 shrink-0' />
							<div>
								<dt className='text-muted-foreground text-xs tracking-wide uppercase'>
									{label}
								</dt>
								<dd className='text-foreground font-medium'>{value}</dd>
							</div>
						</div>
					))}
				</dl>
			</section>
		</div>
	)
}

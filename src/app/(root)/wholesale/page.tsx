import type { Metadata } from 'next'
import { Package, Percent, Truck, Phone } from 'lucide-react'
import { CONTACTS } from '@/common/constants'
import { TelegramIcon, ViberIcon } from '@/common/components/icons/BrandIcons'
import { WholesaleInquiryForm } from '@/common/components/wholesale/WholesaleInquiryForm'

export const metadata: Metadata = {
	title: 'Оптова закупка та співпраця',
	description:
		'Оптові поставки філаменту та витратних матеріалів для 3D-друку. Спеціальні умови для бізнесу, майстерень та навчальних закладів.'
}

const BENEFITS = [
	{
		icon: Percent,
		title: 'Гнучкі ціни',
		text: 'Індивідуальні умови залежно від обсягів — що більша закупка, то вигідніша ціна.'
	},
	{
		icon: Package,
		title: 'Стабільні поставки',
		text: 'Резервуємо потрібні матеріали та кольори під ваш графік виробництва.'
	},
	{
		icon: Truck,
		title: 'Зручна доставка',
		text: 'Відправляємо Новою Поштою або узгоджуємо доставку під ваші потреби.'
	}
]

export default function WholesalePage() {
	return (
		<div className='container mx-auto max-w-7xl px-4 py-16'>
			{/* Hero */}
			<section className='mb-12 text-center'>
				<p className='text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase'>
					Співпраця
				</p>
				<h1 className='mb-4 text-4xl font-bold tracking-tight'>
					Оптова закупка та <span className='gradient-text'>поставки для бізнесу</span>
				</h1>
				<p className='text-muted-foreground mx-auto max-w-2xl text-lg'>
					Друкуєте на потоці, тримаєте майстерню чи навчаєте 3D-друку? Запропонуємо
					спеціальні умови на філамент та витратні матеріали під ваші обсяги.
				</p>
			</section>

			{/* Benefits */}
			<section className='mb-12 grid gap-6 md:grid-cols-3'>
				{BENEFITS.map(({ icon: Icon, title, text }) => (
					<div
						key={title}
						className='border-border bg-card rounded-2xl border p-6'
					>
						<div className='bg-primary/10 text-primary mb-4 flex h-10 w-10 items-center justify-center rounded-xl'>
							<Icon className='size-5' />
						</div>
						<h2 className='mb-2 text-lg font-semibold'>{title}</h2>
						<p className='text-muted-foreground text-sm'>{text}</p>
					</div>
				))}
			</section>

			{/* Form + contacts */}
			<section className='grid gap-6 lg:grid-cols-3'>
				<div className='border-border bg-card rounded-2xl border p-6 md:p-8 lg:col-span-2'>
					<h2 className='mb-2 text-2xl font-bold'>Залишити заявку</h2>
					<p className='text-muted-foreground mb-6 text-sm'>
						Розкажіть, що вам потрібно — ми зв&apos;яжемося протягом робочого дня та
						запропонуємо індивідуальні умови.
					</p>
					<WholesaleInquiryForm />
				</div>

				<div className='border-border bg-card h-fit rounded-2xl border p-6 md:p-8'>
					<h2 className='mb-2 text-2xl font-bold'>Або напишіть нам</h2>
					<p className='text-muted-foreground mb-6 text-sm'>
						Швидше поговорити напряму? Ми на зв&apos;язку в месенджерах та за
						телефоном.
					</p>
					<div className='flex flex-col gap-4'>
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
				</div>
			</section>
		</div>
	)
}

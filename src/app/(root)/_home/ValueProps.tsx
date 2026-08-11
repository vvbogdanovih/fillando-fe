'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Truck, BadgeCheck, Layers, Headset } from 'lucide-react'

const VALUE_PROPS = [
	{
		icon: Truck,
		title: 'Швидка доставка',
		text: 'Відправляємо Новою Поштою по всій Україні щодня.'
	},
	{
		icon: BadgeCheck,
		title: 'Перевірена якість',
		text: 'Тільки філамент, який ми самі протестували на друк.'
	},
	{
		icon: Layers,
		title: 'Широкий вибір',
		text: 'PLA, PETG, ABS, TPU та Nylon у різних кольорах.'
	},
	{
		icon: Headset,
		title: 'Консультація',
		text: 'Допоможемо підібрати матеріал під ваш принтер і задачу.'
	}
]

export function ValueProps() {
	const reduce = useReducedMotion()

	return (
		<section className='py-8 md:py-12'>
			<p className='text-muted-foreground mb-6 text-xs font-semibold tracking-widest uppercase'>
				Чому Fillando
			</p>
			<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
				{VALUE_PROPS.map(({ icon: Icon, title, text }, i) => (
					<motion.div
						key={title}
						className='card-hover bg-card border-border/50 h-full rounded-2xl border p-6'
						// Perpetual staggered "wave" — each card bobs in turn, cycle ~5s.
						animate={reduce ? undefined : { y: [0, -10, 0] }}
						transition={
							reduce
								? undefined
								: {
										duration: 0.6,
										ease: 'easeInOut',
										repeat: Infinity,
										repeatDelay: 4.4,
										delay: i * 0.12
									}
						}
						whileHover={reduce ? undefined : { y: -4 }}
					>
						<div className='bg-primary/10 text-primary mb-4 w-fit rounded-xl p-3'>
							<Icon className='size-6' />
						</div>
						<h3 className='font-semibold'>{title}</h3>
						<p className='text-muted-foreground mt-1 text-sm'>{text}</p>
					</motion.div>
				))}
			</div>
		</section>
	)
}

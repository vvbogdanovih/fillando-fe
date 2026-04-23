'use client'

import { useState } from 'react'
import { Header } from '@/common/components/Header'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Textarea } from '@/common/components/ui/textarea'
import { Checkbox } from '@/common/components/ui/checkbox'
import { Switch } from '@/common/components/ui/switch'
import { Slider } from '@/common/components/ui/slider'
import { Badge } from '@/common/components/ui/badge'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/common/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/common/components/ui/dialog'
import { Label } from '@/common/components/ui/label'
import { Bell, Eye, EyeOff, Loader2, Minus, Plus, Search } from 'lucide-react'

const ColorBlock = ({
	name,
	cssVar,
	className
}: {
	name: string
	cssVar: string
	className: string
}) => (
	<div className='flex flex-col gap-2'>
		<div className={`border-border h-20 w-full rounded-lg border ${className}`} />
		<div className='space-y-1'>
			<p className='text-sm font-medium'>{name}</p>
			<p className='text-muted-foreground font-mono text-xs'>{cssVar}</p>
		</div>
	</div>
)

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<section className='space-y-6'>
		<h2 className='border-border border-b pb-2 text-2xl font-bold'>{title}</h2>
		{children}
	</section>
)

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<div className='space-y-4'>
		<h3 className='text-muted-foreground text-lg font-semibold'>{title}</h3>
		{children}
	</div>
)

export function StyleGuide() {
	const [showPassword, setShowPassword] = useState(false)
	const [quantity, setQuantity] = useState(1)
	const [sliderValue, setSliderValue] = useState([50])
	const [inputValue, setInputValue] = useState('')
	const [radioValue, setRadioValue] = useState('option1')

	return (
		<div className='bg-background min-h-screen'>
			<div className='container mx-auto space-y-16 px-4 py-12'>
				{/* Page Title */}
				<div className='space-y-4 text-center'>
					<h1 className='gradient-text text-4xl font-bold'>Style Guide</h1>
					<p className='text-muted-foreground mx-auto max-w-2xl'>
						A comprehensive showcase of all UI components and design tokens used
						throughout the application.
					</p>
				</div>

				{/* 1. Color Palette */}
				<Section title='1. Color Palette'>
					<SubSection title='Core Colors'>
						<div className='grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
							<ColorBlock
								name='Background'
								cssVar='--background'
								className='bg-background'
							/>
							<ColorBlock
								name='Foreground'
								cssVar='--foreground'
								className='bg-foreground'
							/>
							<ColorBlock name='Primary' cssVar='--primary' className='bg-primary' />
							<ColorBlock
								name='Primary Foreground'
								cssVar='--primary-foreground'
								className='bg-primary-foreground'
							/>
							<ColorBlock
								name='Secondary'
								cssVar='--secondary'
								className='bg-secondary'
							/>
							<ColorBlock
								name='Secondary Foreground'
								cssVar='--secondary-foreground'
								className='bg-secondary-foreground'
							/>
						</div>
					</SubSection>

					<SubSection title='UI Colors'>
						<div className='grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
							<ColorBlock name='Muted' cssVar='--muted' className='bg-muted' />
							<ColorBlock
								name='Muted Foreground'
								cssVar='--muted-foreground'
								className='bg-muted-foreground'
							/>
							<ColorBlock name='Accent' cssVar='--accent' className='bg-accent' />
							<ColorBlock
								name='Accent Foreground'
								cssVar='--accent-foreground'
								className='bg-accent-foreground'
							/>
							<ColorBlock name='Card' cssVar='--card' className='bg-card' />
							<ColorBlock
								name='Card Foreground'
								cssVar='--card-foreground'
								className='bg-card-foreground'
							/>
						</div>
					</SubSection>

					<SubSection title='Feedback & Utility Colors'>
						<div className='grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
							<ColorBlock
								name='Destructive'
								cssVar='--destructive'
								className='bg-destructive'
							/>
							<ColorBlock
								name='Destructive Foreground'
								cssVar='--destructive-foreground'
								className='bg-destructive-foreground'
							/>
							<ColorBlock name='Border' cssVar='--border' className='bg-border' />
							<ColorBlock name='Input' cssVar='--input' className='bg-input' />
							<ColorBlock name='Ring' cssVar='--ring' className='bg-ring' />
							<ColorBlock name='Popover' cssVar='--popover' className='bg-popover' />
						</div>
					</SubSection>

					<SubSection title='Filament Type Colors'>
						<div className='grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5'>
							<ColorBlock
								name='PLA'
								cssVar='--filament-pla'
								className='bg-filament-pla'
							/>
							<ColorBlock
								name='PETG'
								cssVar='--filament-petg'
								className='bg-filament-petg'
							/>
							<ColorBlock
								name='ABS'
								cssVar='--filament-abs'
								className='bg-filament-abs'
							/>
							<ColorBlock
								name='TPU'
								cssVar='--filament-tpu'
								className='bg-filament-tpu'
							/>
							<ColorBlock
								name='Nylon'
								cssVar='--filament-nylon'
								className='bg-filament-nylon'
							/>
						</div>
					</SubSection>
				</Section>

				{/* 2. Buttons */}
				<Section title='2. Buttons'>
					<SubSection title='Button Variants'>
						<div className='flex flex-wrap gap-4'>
							<Button variant='default'>Primary</Button>
							<Button variant='secondary'>Secondary</Button>
							<Button variant='outline'>Outline</Button>
							<Button variant='ghost'>Ghost</Button>
							<Button variant='link'>Link</Button>
							<Button variant='destructive'>Destructive</Button>
						</div>
					</SubSection>

					<SubSection title='Button Sizes'>
						<div className='flex flex-wrap items-center gap-4'>
							<Button size='sm'>Small</Button>
							<Button size='default'>Default</Button>
							<Button size='lg'>Large</Button>
							<Button size='icon'>
								<Plus className='h-4 w-4' />
							</Button>
						</div>
					</SubSection>

					<SubSection title='Button States'>
						<div className='flex flex-wrap gap-4'>
							<Button>Normal</Button>
							<Button className='transition-transform hover:scale-105'>
								Hover Me
							</Button>
							<Button disabled>Disabled</Button>
							<Button disabled>
								<Loader2 className='mr-2 h-4 w-4 animate-spin' />
								Loading
							</Button>
						</div>
					</SubSection>
				</Section>

				{/* 3. Form Inputs */}
				<Section title='3. Form Inputs'>
					<div className='grid gap-8 md:grid-cols-2'>
						<SubSection title='Text Inputs'>
							<div className='space-y-4'>
								<div className='space-y-2'>
									<Label>Placeholder State</Label>
									<Input placeholder='Enter your email...' />
								</div>
								<div className='space-y-2'>
									<Label>Filled State</Label>
									<Input value='john@example.com' readOnly />
								</div>
								<div className='space-y-2'>
									<Label>Focus State (click to see)</Label>
									<Input
										placeholder='Click to focus...'
										value={inputValue}
										onChange={e => setInputValue(e.target.value)}
									/>
								</div>
								<div className='space-y-2'>
									<Label className='text-destructive'>Error State</Label>
									<Input
										placeholder='Invalid input'
										className='border-destructive focus-visible:ring-destructive'
									/>
									<p className='text-destructive text-sm'>
										This field is required
									</p>
								</div>
							</div>
						</SubSection>

						<SubSection title='Other Input Types'>
							<div className='space-y-4'>
								<div className='space-y-2'>
									<Label>Number Input</Label>
									<Input type='number' placeholder='0' min={0} max={100} />
								</div>
								<div className='space-y-2'>
									<Label>Password with Toggle</Label>
									<div className='relative'>
										<Input
											type={showPassword ? 'text' : 'password'}
											placeholder='Enter password'
											defaultValue='mypassword123'
										/>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											className='absolute top-0 right-0 h-full px-3 hover:bg-transparent'
											onClick={() => setShowPassword(!showPassword)}
										>
											{showPassword ? (
												<EyeOff className='h-4 w-4' />
											) : (
												<Eye className='h-4 w-4' />
											)}
										</Button>
									</div>
								</div>
								<div className='space-y-2'>
									<Label>Textarea</Label>
									<Textarea placeholder='Enter your message...' />
								</div>
								<div className='space-y-2'>
									<Label>Disabled Input</Label>
									<Input placeholder='Cannot edit' disabled />
								</div>
							</div>
						</SubSection>
					</div>
				</Section>

				{/* 4. Selectors & Controls */}
				<Section title='4. Selectors & Controls'>
					<div className='grid gap-8 md:grid-cols-2'>
						<SubSection title='Dropdown Select'>
							<div className='space-y-4'>
								<Select>
									<SelectTrigger className='h-10 w-full'>
										<SelectValue placeholder='Select a filament type' />
									</SelectTrigger>
									<SelectContent position='popper'>
										<SelectItem value='pla'>PLA</SelectItem>
										<SelectItem value='petg'>PETG</SelectItem>
										<SelectItem value='abs'>ABS</SelectItem>
										<SelectItem value='tpu'>TPU</SelectItem>
										<SelectItem value='nylon'>Nylon</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</SubSection>

						<SubSection title='Checkboxes'>
							<div className='space-y-4'>
								<div className='flex items-center space-x-2'>
									<Checkbox id='check1' />
									<Label htmlFor='check1'>Unchecked</Label>
								</div>
								<div className='flex items-center space-x-2'>
									<Checkbox id='check2' defaultChecked />
									<Label htmlFor='check2'>Checked</Label>
								</div>
								<div className='flex items-center space-x-2'>
									<Checkbox id='check3' disabled />
									<Label htmlFor='check3' className='text-muted-foreground'>
										Disabled
									</Label>
								</div>
							</div>
						</SubSection>

						<SubSection title='Radio Buttons'>
							<div className='space-y-4'>
								{['option1', 'option2', 'option3'].map(option => (
									<div key={option} className='flex items-center space-x-2'>
										<div
											className={`h-4 w-4 cursor-pointer rounded-full border-2 transition-colors ${
												radioValue === option
													? 'border-primary bg-primary'
													: 'border-input hover:border-primary/50'
											}`}
											onClick={() => setRadioValue(option)}
										>
											{radioValue === option && (
												<div className='flex h-full w-full items-center justify-center'>
													<div className='bg-primary-foreground h-1.5 w-1.5 rounded-full' />
												</div>
											)}
										</div>
										<Label
											className='cursor-pointer'
											onClick={() => setRadioValue(option)}
										>
											Option {option.slice(-1)}
										</Label>
									</div>
								))}
							</div>
						</SubSection>

						<SubSection title='Toggle Switches'>
							<div className='space-y-4'>
								<div className='flex items-center space-x-2'>
									<Switch id='switch1' />
									<Label htmlFor='switch1'>Off by default</Label>
								</div>
								<div className='flex items-center space-x-2'>
									<Switch id='switch2' defaultChecked />
									<Label htmlFor='switch2'>On by default</Label>
								</div>
								<div className='flex items-center space-x-2'>
									<Switch id='switch3' disabled />
									<Label htmlFor='switch3' className='text-muted-foreground'>
										Disabled
									</Label>
								</div>
							</div>
						</SubSection>
					</div>
				</Section>

				{/* 5. Range & Sliders */}
				<Section title='5. Range & Sliders'>
					<div className='max-w-md space-y-6'>
						<SubSection title='Range Slider'>
							<div className='space-y-4'>
								<Slider
									value={sliderValue}
									onValueChange={setSliderValue}
									max={100}
									step={1}
								/>
								<p className='text-muted-foreground text-sm'>
									Current value:{' '}
									<span className='text-foreground font-mono'>
										{sliderValue[0]}
									</span>
								</p>
							</div>
						</SubSection>

						<SubSection title='Price Range Example'>
							<div className='space-y-4'>
								<div className='text-muted-foreground flex justify-between text-sm'>
									<span>$0</span>
									<span>$100</span>
								</div>
								<Slider defaultValue={[25, 75]} max={100} step={5} />
							</div>
						</SubSection>
					</div>
				</Section>

				{/* 6. Specialty & E-commerce UI */}
				<Section title='6. Specialty & E-commerce UI'>
					<div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
						<SubSection title='Search Bar'>
							<div className='relative'>
								<Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
								<Input placeholder='Search products...' className='pl-10' />
							</div>
						</SubSection>

						<SubSection title='Quantity Stepper'>
							<div className='flex items-center gap-2'>
								<Button
									variant='outline'
									size='icon'
									onClick={() => setQuantity(Math.max(1, quantity - 1))}
									disabled={quantity <= 1}
								>
									<Minus className='h-4 w-4' />
								</Button>
								<span className='w-12 text-center font-medium'>{quantity}</span>
								<Button
									variant='outline'
									size='icon'
									onClick={() => setQuantity(quantity + 1)}
								>
									<Plus className='h-4 w-4' />
								</Button>
							</div>
						</SubSection>

						<SubSection title='Badges'>
							<div className='space-y-4'>
								<div className='flex flex-wrap gap-2'>
									<Badge>Default</Badge>
									<Badge variant='secondary'>Secondary</Badge>
									<Badge variant='outline'>Outline</Badge>
									<Badge variant='destructive'>Destructive</Badge>
								</div>
								<div className='flex items-center gap-2'>
									<span className='text-muted-foreground text-sm'>
										Notification Badge:
									</span>
									<div className='relative'>
										<Bell className='h-6 w-6' />
										<span className='bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold'>
											3
										</span>
									</div>
								</div>
							</div>
						</SubSection>
					</div>
				</Section>

				{/* 7. Feedback & Layout */}
				<Section title='7. Feedback & Layout'>
					<div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
						<SubSection title='Activity Indicators'>
							<div className='flex items-center gap-6'>
								<div className='flex flex-col items-center gap-2'>
									<Loader2 className='text-primary h-8 w-8 animate-spin' />
									<span className='text-muted-foreground text-xs'>Spinner</span>
								</div>
								<div className='flex flex-col items-center gap-2'>
									<div className='flex gap-1'>
										{[0, 1, 2].map(i => (
											<div
												key={i}
												className='bg-primary h-2 w-2 animate-bounce rounded-full'
												style={{
													animationDelay: `${i * 0.15}s`
												}}
											/>
										))}
									</div>
									<span className='text-muted-foreground text-xs'>Dots</span>
								</div>
								<div className='flex flex-col items-center gap-2'>
									<div className='bg-secondary h-1 w-24 overflow-hidden rounded-full'>
										<div className='bg-primary h-full w-1/2 animate-pulse rounded-full' />
									</div>
									<span className='text-muted-foreground text-xs'>Progress</span>
								</div>
							</div>
						</SubSection>

						<SubSection title='Card with Elevation'>
							<Card className='card-hover'>
								<CardHeader>
									<CardTitle>Sample Card</CardTitle>
									<CardDescription>
										A card with shadow and hover effect
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p className='text-muted-foreground text-sm'>
										Hover over this card to see the elevation effect in action.
									</p>
								</CardContent>
							</Card>
						</SubSection>

						<SubSection title='Modal Dialog'>
							<Dialog>
								<DialogTrigger asChild>
									<Button>Open Modal</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Sample Modal</DialogTitle>
										<DialogDescription>
											This is an example of a modal dialog component. It can
											contain any content you need.
										</DialogDescription>
									</DialogHeader>
									<div className='py-4'>
										<p className='text-muted-foreground text-sm'>
											Modal content goes here. You can add forms, information,
											or any other components.
										</p>
									</div>
								</DialogContent>
							</Dialog>
						</SubSection>
					</div>
				</Section>

				{/* Gradient Examples */}
				<Section title='Bonus: Gradients & Effects'>
					<div className='grid gap-6 md:grid-cols-3'>
						<div className='space-y-2'>
							<div
								className='h-24 rounded-lg'
								style={{ background: 'var(--gradient-primary)' }}
							/>
							<p className='text-sm font-medium'>Primary Gradient</p>
							<p className='text-muted-foreground font-mono text-xs'>
								--gradient-primary
							</p>
						</div>
						<div className='space-y-2'>
							<div
								className='h-24 rounded-lg'
								style={{ background: 'var(--gradient-accent)' }}
							/>
							<p className='text-sm font-medium'>Accent Gradient</p>
							<p className='text-muted-foreground font-mono text-xs'>
								--gradient-accent
							</p>
						</div>
						<div className='space-y-2'>
							<div className='glow-primary border-border bg-card h-24 rounded-lg border' />
							<p className='text-sm font-medium'>Glow Effect</p>
							<p className='text-muted-foreground font-mono text-xs'>--shadow-glow</p>
						</div>
					</div>
				</Section>
			</div>
		</div>
	)
}

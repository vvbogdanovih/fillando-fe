'use client'
import { ui } from './admin-ui'
import { useState } from 'react'
import {
	categoryTreeApi,
	type CategoryCommand,
	type ConversionPlan,
	type TreeItem
} from '../category-tree.api'
import { categoryError } from '../category-tree.utils'
import { pluralUk } from '@/common/utils/plural.utils'

const button = 'rounded border px-3 py-2 text-sm disabled:opacity-50'

type Source = { id: string; name: string }
type Assignments = Record<string, string>

/** Every product of the category, page by page (25 per page on the server). */
async function loadProducts(categoryId: string) {
	const products: Source[] = []
	let cursor: string | undefined
	do {
		const page = await categoryTreeApi.typedProducts(categoryId, cursor)
		products.push(...page.items)
		cursor = page.next_cursor ?? undefined
	} while (cursor)
	return products
}

/**
 * Product category → group with an explicit distribution (Plan-0010 F02/B02, TD-0013 mutations §5).
 * The admin sends every product and every landing to another product category; the server checks
 * the whole plan (values that would be lost, pins, addresses) without writing, and only an
 * executable plan can run — as one operation. The category keeps its address and becomes a group;
 * products keep theirs; a published landing's old address redirects to its new one.
 */
export function CategoryConversionPanel({
	item,
	items,
	revision,
	disabled,
	onSubmit
}: {
	item: TreeItem
	items: TreeItem[]
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [opened, setOpened] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [products, setProducts] = useState<Source[] | null>(null)
	const [landings, setLandings] = useState<{ id: string; slug: string; status: string }[]>([])
	// The server lists the first 500 landings only (P06): a plan must place every one.
	const [landingsTruncated, setLandingsTruncated] = useState(false)
	const [productTargets, setProductTargets] = useState<Assignments>({})
	const [landingTargets, setLandingTargets] = useState<Assignments>({})
	const [all, setAll] = useState('')
	const [adopt, setAdopt] = useState(true)
	const [plan, setPlan] = useState<ConversionPlan | null>(null)
	const [confirming, setConfirming] = useState(false)
	const targets = items.filter(
		row =>
			row._id !== item._id &&
			row.kind === 'product' &&
			row.attribute_contract_version === 2 &&
			(row.status === 'draft' || row.status === 'active')
	)
	const nameOf = (id?: string) => items.find(row => row._id === id)?.name ?? 'категорія'
	const productName = (id?: string) => products?.find(row => row.id === id)?.name ?? 'Товар'
	const landingSlug = (id?: string) => landings.find(row => row.id === id)?.slug ?? ''
	// Any change of the distribution invalidates a checked plan.
	const reset = () => {
		setPlan(null)
		setConfirming(false)
	}

	async function open() {
		setOpened(true)
		if (products) return
		setLoading(true)
		setError('')
		try {
			const [list, pages] = await Promise.all([
				loadProducts(item._id),
				categoryTreeApi.typedLandings(item._id)
			])
			setProducts(list)
			setLandings(
				pages.items.map(row => ({ id: row._id, slug: row.slug, status: row.status }))
			)
			setLandingsTruncated(pages.truncated)
		} catch (failure) {
			setError(categoryError(failure).message)
		} finally {
			setLoading(false)
		}
	}
	async function check() {
		setLoading(true)
		setError('')
		reset()
		try {
			setPlan(
				await categoryTreeApi.conversionPlan(item._id, {
					target_kind: 'group',
					assignments: (products ?? []).map(row => ({
						product_id: row.id,
						target_category_id: productTargets[row.id]
					})),
					landing_assignments: landings.map(row => ({
						landing_id: row.id,
						target_category_id: landingTargets[row.id]
					})),
					adopt_targets: adopt
				})
			)
		} catch (failure) {
			setError(categoryError(failure).message)
		} finally {
			setLoading(false)
		}
	}

	const complete =
		!!products &&
		products.every(row => productTargets[row.id]) &&
		landings.every(row => landingTargets[row.id])
	const select = (value: string, onChange: (value: string) => void, label: string) => (
		<select
			className={ui.input}
			aria-label={label}
			value={value}
			onChange={event => {
				onChange(event.target.value)
				reset()
			}}
		>
			<option value=''>— оберіть категорію —</option>
			{targets.map(row => (
				<option key={row._id} value={row._id}>
					{row.name}
					{row.status === 'draft' ? ' (чернетка)' : ''}
				</option>
			))}
		</select>
	)
	const problemText = (problem: ConversionPlan['problems'][number]) => {
		const target = `«${nameOf(problem.target_category_id)}»`
		const landing = `Сторінка /${item.slug}/${landingSlug(problem.landing_id)}`
		switch (problem.code) {
			case 'CONVERSION_PRODUCT_LOSES_VALUES':
				return `${productName(problem.product_id)}: у ${target} немає місця для ${(problem.dropped ?? []).map(row => `${row.label} (${row.value_label})`).join(', ')}. Додайте ці характеристики в ${target} або оберіть іншу категорію.`
			case 'CONVERSION_PRODUCT_AXIS':
				return `${productName(problem.product_id)}: варіанти товару не виражаються у ${target} (інша вісь чи значення).`
			case 'CONVERSION_PRODUCT_MISSING_REQUIRED':
				return `${productName(problem.product_id)}: в опублікованій ${target} обов’язкові характеристики лишились би без значення (${problem.missing_required?.length ?? 0}).`
			case 'CONVERSION_PRODUCT_INVALID':
				return `${productName(problem.product_id)}: значення не проходять перевірку ${target}.`
			case 'CONVERSION_DATA_INCONSISTENT':
				return 'Варіанти категорії не збігаються з її товарами — потрібна технічна перевірка даних.'
			case 'CONVERSION_LANDING_NOT_TYPED':
				return `${landing}: старого формату — спершу збережіть її в редакторі посадкових сторінок.`
			case 'CONVERSION_LANDING_PINS':
				return `${landing}: закріплені фільтри не виражаються в характеристиках ${target}.`
			case 'CONVERSION_LANDING_SLUG_TAKEN':
				return `${landing}: у ${target} уже є сторінка з такою адресою.`
			case 'CONVERSION_LANDING_PINS_DUPLICATE':
				return `${landing}: у ${target} уже є сторінка з тими самими фільтрами.`
			case 'ROUTE_PATH_TAKEN':
				return `${landing}: її стара чи нова адреса зайнята іншим записом.`
			case 'CATEGORY_PARENT_NOT_PUBLIC':
				return `${target} опублікована, а ця категорія — чернетка: перенести ${target} у групу-чернетку не можна. Зніміть «Перенести цільові категорії в нову групу» або опублікуйте категорію.`
			case 'CONVERSION_PLAN_TOO_LARGE':
				return `План завеликий (${problem.detail} змін, межа ${problem.limit ?? 500}): спершу перенесіть частину товарів у редакторі товару.`
			default:
				return problem.code
		}
	}
	const warningText = (warning: ConversionPlan['warnings'][number]) => {
		const landing = `Сторінка /${item.slug}/${landingSlug(warning.landing_id)}`
		switch (warning.code) {
			case 'CONVERSION_ACTIVE_SKUS_TO_DRAFT':
				return `${warning.count} ${pluralUk(warning.count ?? 0, 'активний варіант', 'активні варіанти', 'активних варіантів')} перейдуть у категорії-чернетки й зникнуть із сайту, доки ці категорії не опублікують.`
			case 'CONVERSION_LANDING_HIDDEN':
				return `${landing} переходить у неопубліковану «${nameOf(warning.target_category_id)}» і зникне з сайту до її публікації.`
			case 'CONVERSION_LANDING_TARGET_EMPTY':
				return `${landing}: у «${nameOf(warning.target_category_id)}» не буде активних товарів — сторінка стане порожньою.`
			case 'CONVERSION_SETTINGS_NOT_CARRIED':
				return 'Налаштування картки товару й фіду цієї категорії не переносяться — задайте їх у цільових категоріях.'
			default:
				return warning.code
		}
	}

	return (
		<section className='space-y-3 border-t pt-4' aria-label='Перетворення на групу'>
			<button
				type='button'
				className={button}
				aria-expanded={opened}
				disabled={disabled && !opened}
				onClick={() => (opened ? setOpened(false) : void open())}
			>
				Перетворити на групу з розподілом товарів
			</button>
			{opened && (
				<div className='space-y-3 text-sm'>
					<p className='text-gray-500'>
						Категорія стане групою з тією самою адресою /{item.slug}. Кожен товар (з
						усіма варіантами) і кожна посадкова сторінка переходять у товарну категорію,
						яку ви оберете; адреси товарів не змінюються, стара адреса опублікованої
						сторінки перенаправлятиме на нову. Характеристики, картка й фід цієї
						категорії не переносяться. Цільові категорії створіть заздалегідь —
						наприклад, «Скопіювати з категорії».
					</p>
					{loading && <p>Завантаження…</p>}
					{error && (
						<p role='alert' className='text-red-700'>
							{error}
						</p>
					)}
					{products && !targets.length && (
						<p>
							Немає інших товарних категорій нового каталогу, куди перейдуть товари.
						</p>
					)}
					{landingsTruncated && (
						<p role='alert' className='text-red-700'>
							У категорії понад 500 посадкових сторінок — план не може розподілити їх
							усі. Спершу зменште кількість сторінок у редакторі посадкових сторінок.
						</p>
					)}
					{products && targets.length > 0 && !landingsTruncated && (
						<>
							<div className='flex flex-wrap items-end gap-2'>
								<label className='block min-w-64 flex-1'>
									Усі товари й сторінки в
									{select(all, setAll, 'Усі товари й сторінки в')}
								</label>
								<button
									type='button'
									className={button}
									disabled={!all}
									onClick={() => {
										setProductTargets(
											Object.fromEntries(products.map(row => [row.id, all]))
										)
										setLandingTargets(
											Object.fromEntries(landings.map(row => [row.id, all]))
										)
										reset()
									}}
								>
									Призначити всім
								</button>
							</div>
							<fieldset className='space-y-2'>
								<legend className='font-medium'>Товари ({products.length})</legend>
								{products.map(row => (
									<label key={row.id} className='block'>
										{row.name}
										{select(
											productTargets[row.id] ?? '',
											value =>
												setProductTargets(current => ({
													...current,
													[row.id]: value
												})),
											`Категорія для «${row.name}»`
										)}
									</label>
								))}
							</fieldset>
							{landings.length > 0 && (
								<fieldset className='space-y-2'>
									<legend className='font-medium'>
										Посадкові сторінки ({landings.length})
									</legend>
									{landings.map(row => (
										<label key={row.id} className='block'>
											/{item.slug}/{row.slug}
											{row.status === 'draft' ? ' (чернетка)' : ''}
											{select(
												landingTargets[row.id] ?? '',
												value =>
													setLandingTargets(current => ({
														...current,
														[row.id]: value
													})),
												`Категорія для сторінки /${row.slug}`
											)}
										</label>
									))}
								</fieldset>
							)}
							<label className='flex items-center gap-2'>
								<input
									type='checkbox'
									checked={adopt}
									onChange={event => {
										setAdopt(event.target.checked)
										reset()
									}}
								/>
								Перенести цільові категорії в нову групу
							</label>
							<button
								type='button'
								className={button}
								disabled={disabled || loading || !complete}
								onClick={() => void check()}
							>
								Перевірити план
							</button>
						</>
					)}
					{plan && (
						<div className='space-y-2 rounded-lg border p-3' aria-live='polite'>
							<p>
								{plan.counts.products}{' '}
								{pluralUk(plan.counts.products, 'товар', 'товари', 'товарів')},{' '}
								{plan.counts.variants}{' '}
								{pluralUk(plan.counts.variants, 'варіант', 'варіанти', 'варіантів')}
								, {plan.counts.landings}{' '}
								{pluralUk(
									plan.counts.landings,
									'посадкова сторінка',
									'посадкові сторінки',
									'посадкових сторінок'
								)}{' '}
								→ {plan.counts.targets}{' '}
								{pluralUk(
									plan.counts.targets,
									'категорія',
									'категорії',
									'категорій'
								)}
								{plan.counts.routes
									? `; ${plan.counts.routes} ${pluralUk(plan.counts.routes, 'стара адреса перенаправлятиме', 'старі адреси перенаправлятимуть', 'старих адрес перенаправлятимуть')}`
									: ''}
								.
							</p>
							{plan.problems.length > 0 && (
								<>
									<p className='font-medium text-red-700'>
										План не виконується — виправте:
									</p>
									<ul className='list-disc space-y-1 pl-5 text-red-700'>
										{plan.problems.map((problem, index) => (
											<li key={index}>{problemText(problem)}</li>
										))}
									</ul>
								</>
							)}
							{plan.warnings.length > 0 && (
								<ul className='list-disc space-y-1 pl-5'>
									{plan.warnings.map((warning, index) => (
										<li key={index}>{warningText(warning)}</li>
									))}
								</ul>
							)}
							{plan.plan_id && (
								<>
									{/* The trigger turns into «Скасувати» where it stands and the
									    confirmation opens on a line of its own: the second click of
									    a double-click cancels, it never confirms. */}
									<button
										type='button'
										className={button}
										disabled={disabled && !confirming}
										onClick={() => setConfirming(!confirming)}
									>
										{confirming ? 'Скасувати' : 'Перетворити на групу'}
									</button>
									{confirming && (
										<div>
											<button
												type='button'
												className={`${button} border-red-300 text-red-700`}
												disabled={disabled}
												onClick={() =>
													onSubmit({
														type: 'convert',
														id: item._id,
														body: {
															kind: 'group',
															plan_id: plan.plan_id!,
															expected_revision: revision
														}
													})
												}
											>
												Так, перетворити «{item.name}» на групу
											</button>
										</div>
									)}
								</>
							)}
						</div>
					)}
				</div>
			)}
		</section>
	)
}

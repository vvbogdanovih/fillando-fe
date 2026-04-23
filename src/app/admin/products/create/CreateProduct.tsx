import { ProductForm } from '../_components/ProductForm'

export const CreateProduct = () => {
	return (
		<div className='w-full max-w-7xl px-8 py-8'>
			<h1 className='mb-8 text-xl font-semibold text-gray-900'>Новий продукт</h1>
			<ProductForm />
		</div>
	)
}

import { EditProduct } from './EditProduct'

type Props = {
	params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
	const { id } = await params
	return <EditProduct id={id} />
}

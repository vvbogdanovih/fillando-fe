import { ProductWorkspaceGate } from '../../ProductWorkspaceGate'
import { EditProduct } from './EditProduct'

type Props = {
	params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
	const { id } = await params
	return (
		<ProductWorkspaceGate productId={id}>
			<EditProduct id={id} />
		</ProductWorkspaceGate>
	)
}

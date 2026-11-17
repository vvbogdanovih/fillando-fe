import { ProductWorkspaceGate } from '../ProductWorkspaceGate'
import { CreateProduct } from './CreateProduct'

export default function CreateProductPage() {
	return (
		<ProductWorkspaceGate>
			<CreateProduct />
		</ProductWorkspaceGate>
	)
}

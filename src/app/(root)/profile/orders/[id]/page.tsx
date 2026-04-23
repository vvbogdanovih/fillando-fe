import { OrderDetails } from '../OrderDetails'

interface ProfileOrderDetailsPageProps {
	params: Promise<{ id: string }>
}

export default async function ProfileOrderDetailsPage({ params }: ProfileOrderDetailsPageProps) {
	const { id } = await params
	return <OrderDetails orderId={id} />
}

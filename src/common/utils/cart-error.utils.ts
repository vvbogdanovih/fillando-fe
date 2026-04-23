export const mapCartErrorMessage = (message?: string) => {
	if (!message) return 'Не вдалося додати до кошика'

	const normalizedMessage = message.trim().toLowerCase()

	if (normalizedMessage.includes('variant is out of stock')) {
		return 'Товару немає в наявності'
	}

	return message
}

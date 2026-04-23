import { type FieldNamesMarkedBoolean } from 'react-hook-form'
import { type ProfileFormValues, type UpdateProfilePayload } from './profile.schema'

type HttpLikeError = Error & {
	status?: number
}

export const buildProfileUpdatePayload = (
	values: ProfileFormValues,
	dirtyFields: Partial<Readonly<FieldNamesMarkedBoolean<ProfileFormValues>>>
): UpdateProfilePayload => {
	const payload: UpdateProfilePayload = {}

	if (dirtyFields.name) {
		payload.name = values.name.trim()
	}

	if (dirtyFields.phone) {
		const normalizedPhone = values.phone.trim()
		payload.phone = normalizedPhone === '' ? null : normalizedPhone
	}

	if (dirtyFields.picture) {
		const normalizedPicture = values.picture.trim()
		payload.picture = normalizedPicture === '' ? null : normalizedPicture
	}

	return payload
}

export const mapProfileErrorMessage = (error: unknown) => {
	const typedError = error as HttpLikeError | undefined
	const message = typedError?.message ?? 'Не вдалося оновити профіль'
	const status = typedError?.status
	const lower = message.toLowerCase()

	if (status === 409 || lower.includes('already') || lower.includes('вже')) {
		return 'Цей номер вже використовується'
	}

	if (
		status === 400 &&
		(lower.includes('phone') || lower.includes('+380') || lower.includes('format'))
	) {
		return 'Телефон має бути у форматі +380XXXXXXXXX'
	}

	if (status === 400 && lower.includes('empty')) {
		return 'Немає змін для збереження'
	}

	if (status === 404) {
		return 'Користувача не знайдено'
	}

	return message
}

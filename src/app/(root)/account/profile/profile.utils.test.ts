import { describe, expect, it } from 'vitest'
import { buildProfileUpdatePayload, mapProfileErrorMessage } from './profile.utils'
import { type ProfileFormValues } from './profile.schema'

const baseValues: ProfileFormValues = {
	email: 'user@example.com',
	name: 'Іван',
	phone: '+380991112233',
	picture: 'https://example.com/avatar.jpg'
}

describe('profile utils', () => {
	it('builds patch payload only from dirty fields', () => {
		const payload = buildProfileUpdatePayload(
			{
				...baseValues,
				name: 'Петро',
				phone: '',
				picture: '   '
			},
			{
				name: true,
				phone: true,
				picture: true
			}
		)

		expect(payload).toEqual({
			name: 'Петро',
			phone: null,
			picture: null
		})
	})

	it('maps backend errors to user-friendly messages', () => {
		expect(mapProfileErrorMessage({ message: 'conflict', status: 409 })).toBe(
			'Цей номер вже використовується'
		)
		expect(mapProfileErrorMessage({ message: 'phone invalid format', status: 400 })).toBe(
			'Телефон має бути у форматі +380XXXXXXXXX'
		)
	})
})

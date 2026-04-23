export const FORM_ERRORS = {
	FIELD_IS_REQUIRED: (field?: string) =>
		field ? `Поле "${field}" є обов'язковим` : "Поле є обов'язковим",
	FIELD_SHOULD_BE_EMAIL: 'Поле повинно бути email',
	FIELD_SHOULD_BE_MIN_LENGTH: (min: number) => `Поле повинно бути мінімальної довжини ${min}`,
	PASSWORDS_DO_NOT_MATCH: 'Паролі не збігаються',
	FIELD_SHOULD_BE_NUMBER: 'Поле повинно бути числом',
	FIELD_SHOULD_BE_DATE: 'Поле повинно бути датою'
} as const

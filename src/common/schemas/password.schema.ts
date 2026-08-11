import '@/common/lib/zod-locale'
import * as z from 'zod'
import { FORM_ERRORS } from '../constants'

export const passwordSchema = z
	.string()
	.min(6, { message: FORM_ERRORS.FIELD_SHOULD_BE_MIN_LENGTH(6) })

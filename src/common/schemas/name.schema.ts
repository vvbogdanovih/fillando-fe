import { z } from 'zod'
import { FORM_ERRORS } from '../constants'

export const nameSchema = z.string().min(2, { message: FORM_ERRORS.FIELD_SHOULD_BE_MIN_LENGTH(2) })

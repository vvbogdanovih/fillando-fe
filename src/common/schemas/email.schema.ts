import { z } from 'zod'
import { FORM_ERRORS } from '../constants'

export const emailSchema = z.email({ message: FORM_ERRORS.FIELD_SHOULD_BE_EMAIL })

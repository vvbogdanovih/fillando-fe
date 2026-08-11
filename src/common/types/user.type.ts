import '@/common/lib/zod-locale'
import * as z from 'zod'
import { userSchema } from '@/common/schemas'

// Single source of truth: userSchema lives in src/common/schemas/user.schema.ts
export type User = z.infer<typeof userSchema>

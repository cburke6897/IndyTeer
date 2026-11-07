import { CATEGORY_IMAGE } from '../../lib/constants'
import type { Opportunity } from '../../types'

/** The opportunity's own image, falling back to a category photo. */
export const oppImage = (o: Opportunity) => o.image ?? CATEGORY_IMAGE[o.category] ?? null

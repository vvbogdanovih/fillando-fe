import { permanentRedirect } from 'next/navigation'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'

type RawSearchParams = Record<string, string | string[] | undefined>
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/**
 * What the current address itself answers for this query (P03): its own redirect — a legacy
 * query translated, a landing matched — a 404, or `null` (it renders).
 */
export type MovedTargetDecision = { kind: 'redirect'; to: string } | { kind: 'not_found' } | null

/**
 * SERVER ONLY. An address that 404s may be an old one: a category, landing or SKU whose address was
 * changed with a redirect (Plan-0010 B07). `GET /routes/resolve` answers its current public path;
 * this issues the one permanent redirect there, query kept. Only slug-shaped paths are looked up
 * (anything else is a plain 404 without a request). A 404 from the lookup means «not moved»; any
 * other failure is an outage and throws — a 5xx is safer for a moved address than an indexed 404.
 * The tags are the three resources whose slug change the backend revalidates.
 *
 * `decide` lets the current address answer for itself first (P03, owner decision 02.11.2026), so
 * an old address is one hop to the final page, never one to the new address and another from it:
 * its redirect is followed directly, its 404 stays a 404 on the old address.
 */
export async function redirectIfMoved(
	segments: string[],
	searchParams: RawSearchParams = {},
	decide?: (targetPath: string, searchParams: RawSearchParams) => Promise<MovedTargetDecision>
) {
	if (!segments.length || segments.some(segment => !SLUG.test(segment))) return
	const path = `/${segments.join('/')}`
	const moved = await serverFetch<{ kind: 'redirect'; target_path: string }>(
		`/routes/resolve?path=${encodeURIComponent(path)}`,
		{ next: { tags: [CACHE_TAGS.CATEGORIES, CACHE_TAGS.PRODUCTS, CACHE_TAGS.LANDINGS] } }
	)
	if (!moved || moved.kind !== 'redirect' || !moved.target_path.startsWith('/')) return
	const decision = decide ? await decide(moved.target_path, searchParams) : null
	if (decision?.kind === 'not_found') return
	if (decision?.kind === 'redirect') return permanentRedirect(decision.to)
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(searchParams))
		for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
			query.append(key, item)
	const search = query.toString()
	permanentRedirect(search ? `${moved.target_path}?${search}` : moved.target_path)
}

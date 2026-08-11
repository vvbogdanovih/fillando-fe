const API = process.env.NEXT_PUBLIC_API_BASE_URL!

export async function serverFetch<T>(path: string): Promise<T | null> {
	try {
		const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } })
		if (!res.ok) return null
		return res.json() as Promise<T>
	} catch {
		return null
	}
}

/**
 * Like `serverFetch`, but distinguishes "genuinely absent" (null) from "upstream
 * failed" (throws). Routes rendered through the full route cache must use this:
 * `serverFetch` collapses an outage into `null`, which renders a 200 "not found"
 * page that ISR then caches for the whole revalidate window.
 */
export async function serverFetchOrThrow<T>(path: string): Promise<T | null> {
	const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } })
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`Upstream ${res.status} for ${path}`)
	return res.json() as Promise<T>
}

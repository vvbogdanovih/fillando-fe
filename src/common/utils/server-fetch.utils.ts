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

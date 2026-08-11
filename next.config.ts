import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const appDir = path.dirname(fileURLToPath(import.meta.url))

// Kill switch for the S3 width-derivative pipeline. Defaults to off so the loader
// can never ship ahead of the backfill; flip to 'true' in the environment once
// `generate-image-derivatives.js` reports a clean VERIFY pass.
const useImageDerivatives = process.env.NEXT_PUBLIC_USE_IMAGE_DERIVATIVES === 'true'

const nextConfig: NextConfig = {
	output: 'standalone',
	reactCompiler: true,
	// Search crawlers get a blocking render so notFound() can set a real 404
	// status; regular users keep streamed responses.
	htmlLimitedBots:
		/Googlebot|Google-InspectionTool|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|TelegramBot/i,
	images: {
		// Two modes, switched by NEXT_PUBLIC_USE_IMAGE_DERIVATIVES.
		//
		// off (default): serve remote URLs as-is (browser → S3). The built-in optimizer
		//   stays disabled — `deviceSizes` only caps the *output* width; Sharp still
		//   downloads/decodes the full S3 object per request, which can OOM a 1–2 GB VPS.
		//   Note `unoptimized` also nulls out srcSet and sizes, so every `sizes=` prop in
		//   the app is inert while this mode is active.
		//
		// on: route through ./image-loader.ts, which rewrites each URL to a width
		//   derivative generated once at upload time. Sharp never runs per request.
		//
		// ⚠️  Only turn this on AFTER the S3 backfill has run and verified clean:
		//     DRY_RUN=false node scripts/migrations/generate-image-derivatives.js
		//     VERIFY=true   node scripts/migrations/generate-image-derivatives.js
		//     A missing derivative is a hard 404 with no fallback.
		...(useImageDerivatives
			? {
					loader: 'custom' as const,
					loaderFile: './image-loader.ts',
					// deviceSizes ∪ imageSizes must equal the backend's DERIVATIVE_WIDTHS
					// exactly. Any extra entry would emit a srcset descriptor (e.g. "256w")
					// for a file that is actually a different width.
					deviceSizes: [320, 640, 1280],
					imageSizes: [128]
				}
			: { unoptimized: true }),
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'fillando.s3.eu-north-1.amazonaws.com'
			},
			// Cloudflare-proxied alias for the same bucket (gives HTTP/2 + edge caching).
			{
				protocol: 'https',
				hostname: 'img.fillando.com'
			}
		]
	},
	async redirects() {
		// Legacy two-level catalog URLs (indexed + in ads) → flat category URLs.
		return [
			{
				source: '/vytratni-materialy-dlia-3d-druku/:sub',
				destination: '/:sub',
				permanent: true
			},
			{
				source: '/vytratni-materialy-dlia-3d-druku',
				destination: '/filament',
				permanent: true
			}
		]
	},
	async headers() {
		return [
			{
				// public/ assets carry no content hash, so busting one means renaming the
				// file. `ico` is excluded on purpose: it would also match the App Router
				// /favicon.ico metadata route.
				source: '/:all*(webp|png|jpg|jpeg|svg|avif)',
				headers: [
					{
						key: 'Cache-Control',
						value: 'public, max-age=31536000, immutable'
					}
				]
			},
			{
				source: '/(.*)',
				headers: [
					{
						key: 'Strict-Transport-Security',
						value: 'max-age=63072000; includeSubDomains; preload'
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff'
					},
					{
						key: 'X-Frame-Options',
						value: 'DENY'
					},
					{
						key: 'Cross-Origin-Opener-Policy',
						value: 'same-origin'
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin'
					},
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=()'
					}
				]
			}
		]
	}
}

export default nextConfig

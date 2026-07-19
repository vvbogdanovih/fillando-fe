import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const appDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
	output: 'standalone',
	reactCompiler: true,
	// Search crawlers get a blocking render so notFound() can set a real 404
	// status; regular users keep streamed responses.
	htmlLimitedBots:
		/Googlebot|Google-InspectionTool|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|TelegramBot/i,
	images: {
		// `deviceSizes` only caps the *output* width; Sharp still downloads/decodes the full S3
		// object per request, which can OOM a 1–2 GB VPS. Serve remote URLs as-is (browser → S3).
		unoptimized: true,
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'fillando.s3.eu-north-1.amazonaws.com'
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

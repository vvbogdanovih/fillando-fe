/**
 * Custom next/image loader — maps an S3 original onto the width derivative the
 * backend generated at upload time (`upload.service.ts` → `writeDerivatives`).
 *
 * The built-in optimizer stays off: it downloads and decodes the full S3 object on
 * every cache miss, which can exhaust a 1–2 GB VPS. This loader only builds a
 * string, so the resize cost was already paid once, at upload.
 *
 * ⚠️  Derivatives must exist in S3 before this is enabled. A missing tier is a hard
 *     404 with no fallback. Run and verify the backfill first:
 *       DRY_RUN=false node scripts/migrations/generate-image-derivatives.js
 *       VERIFY=true   node scripts/migrations/generate-image-derivatives.js
 *
 * Note object keys end in .jpg/.png even when the body is WebP — `buildKey` on the
 * backend derives the extension from the *requested* content type, before
 * conversion. Never infer the format from the key.
 */

// Keep in sync with DERIVATIVE_WIDTHS in the backend upload service.
const TIERS = [128, 320, 640, 1280]

const S3_HOST = /^https:\/\/(fillando\.s3\.[a-z0-9-]+\.amazonaws\.com|img\.fillando\.com)\//
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i

interface LoaderArgs {
	src: string
	width: number
}

export default function s3Loader({ src, width }: LoaderArgs): string {
	// Anything not in our bucket (local /public assets, Google avatars) passes through.
	if (!S3_HOST.test(src) || !IMAGE_EXT.test(src)) return src

	const tier = TIERS.find(t => t >= width) ?? TIERS[TIERS.length - 1]
	return src.replace(IMAGE_EXT, `-${tier}.webp`)
}

export { auth as middleware } from '@/lib/auth'

export const config = {
  // Explicitly protect only page routes — Next.js matchers do NOT support
  // negative lookaheads, so use a positive allowlist instead.
  // API routes handle their own auth (session check or API key).
  matcher: ['/', '/pricing/:path*']
}

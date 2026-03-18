export { auth as middleware } from '@/lib/auth'

export const config = {
  // Exclude /api/agent/* — those routes handle their own auth and need
  // CORS preflight (OPTIONS) to pass through without being intercepted.
  matcher: ['/((?!api/auth|api/agent|_next/static|_next/image|favicon.ico|login).*)']
}

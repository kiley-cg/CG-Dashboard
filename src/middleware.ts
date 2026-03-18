import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-api-key',
}

export async function middleware(req: NextRequest) {
  // Handle ALL CORS preflights at the outermost layer — before auth, before routes
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  // API routes handle their own auth (session check or API key)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Auth-protect page routes via NextAuth
  return (auth as any)(req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)']
}

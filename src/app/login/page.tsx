'use client'

import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'Authentication is not configured on this server. Contact your administrator to set up Google OAuth credentials.',
  AccessDenied: 'Access denied. Your account is not authorized to use this application.',
  Verification: 'The sign-in link is no longer valid. Please try again.',
  OAuthSignin: 'Could not start the Google sign-in flow. Please try again.',
  OAuthCallback: 'Error during Google sign-in callback. Please try again.',
  Default: 'Sign in failed. Please try again.',
}

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const error = urlError ? (ERROR_MESSAGES[urlError] ?? ERROR_MESSAGES.Default) : localError

  async function handleSignIn() {
    setLoading(true)
    setLocalError(null)
    try {
      await signIn('google', { callbackUrl: '/pricing' })
    } catch {
      setLocalError(ERROR_MESSAGES.Default)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Syncore AI Dashboard</h1>
          <p className="text-gray-500 mt-2 text-sm">Sign in with your company Google account to continue</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm text-left">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading || urlError === 'Configuration'}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <GoogleIcon />
              <span>Sign in with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.59.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

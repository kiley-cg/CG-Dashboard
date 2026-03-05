import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PricingTool } from '@/components/PricingTool'
import { signOut } from '@/lib/auth'

export default async function PricingPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Syncore AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <PricingTool />
      </main>
    </div>
  )
}

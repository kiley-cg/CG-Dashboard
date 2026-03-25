import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

// AUTH_SECRET is required by Auth.js v5. Provide a fallback so the app doesn't
// crash with ?error=Configuration when the secret isn't yet in Secret Manager.
// Sessions signed with the fallback are valid only until the next cold start —
// fine for an internal tool. Set AUTH_SECRET in Secret Manager to get stable sessions.
const authSecret = process.env.AUTH_SECRET || 'syncore-ai-fallback-secret-set-auth-secret-in-prod'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    signIn({ user }) {
      const allowedDomain = process.env.ALLOWED_DOMAIN
      if (!allowedDomain) return true
      const domain = user.email?.split('@')[1]
      return domain === allowedDomain
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
})

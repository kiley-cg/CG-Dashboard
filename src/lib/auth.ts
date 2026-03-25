import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
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

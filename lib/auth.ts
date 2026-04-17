import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { getEnv, ensureEnvSecret } from './config/env-runtime'

/**
 * 把 AUTH_SECRET 做成「自愈」的基础设施：缺就自动生成并持久化，
 * 应用永远不会因为 AUTH_SECRET 缺失而抛 MissingSecret。
 * （如果用户/启动脚本已经配好就直接用，开发/部署零心智负担。）
 */
const AUTH_SECRET = ensureEnvSecret('AUTH_SECRET', {
  generator: () => getEnv('NEXTAUTH_SECRET') || crypto.randomBytes(32).toString('base64'),
  placeholders: ['your-secret-here', ''],
  logPrefix: '[auth]',
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        
        if (!user) return null
        
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        
        if (!valid) return null
        
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})

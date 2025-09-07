import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { DEFAULT_PERMISSIONS } from "./permissions"
import type { AccessLevel } from "./permissions"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id
      }
      
      // Always fetch fresh user data from database
      if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email }
          })
          
          if (dbUser) {
            token.accessLevel = dbUser.accessLevel || "guest"
            token.subscriptionStatus = dbUser.subscriptionStatus || "none"
            token.trialStartDate = dbUser.trialStartDate
            token.trialEndDate = dbUser.trialEndDate
            token.subscriptionExpiry = dbUser.subscriptionExpiry
            
            // Set permissions based on access level
            const accessLevel = (dbUser.accessLevel as AccessLevel) || "guest"
            token.permissions = DEFAULT_PERMISSIONS[accessLevel]
          } else {
            // Default guest permissions for users not in database
            token.accessLevel = "guest"
            token.subscriptionStatus = "none"
            token.permissions = DEFAULT_PERMISSIONS.guest
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          // Fallback to guest permissions
          token.accessLevel = "guest"
          token.subscriptionStatus = "none"
          token.permissions = DEFAULT_PERMISSIONS.guest
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.id as string
        session.user.accessLevel = token.accessLevel as string
        session.user.subscriptionStatus = token.subscriptionStatus as string
        session.user.trialStartDate = token.trialStartDate as Date
        session.user.trialEndDate = token.trialEndDate as Date
        session.user.subscriptionExpiry = token.subscriptionExpiry as Date
        session.user.permissions = token.permissions as any
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  events: {
    async createUser({ user }) {
      // Send welcome email or trigger onboarding flow
      console.log("New user created:", user.email)
    }
  }
}
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      accessLevel?: string
      permissions?: any
      subscriptionStatus?: string
      subscriptionExpiry?: Date | null
      trialStartDate?: Date | null
      trialEndDate?: Date | null
    }
    accessToken?: string
  }

  interface User {
    id: string
    googleId: string
    email: string
    name?: string | null
    image?: string | null
    accessLevel?: string
    permissions?: any
    subscriptionStatus?: string
    subscriptionExpiry?: Date | null
    trialStartDate?: Date | null
    trialEndDate?: Date | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
  }
}
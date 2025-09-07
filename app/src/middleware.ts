import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Public routes that don't require authentication
    const publicRoutes = [
      '/',
      '/assessment',
      '/breath',
      '/process',
      '/auth/signin',
      '/auth/error',
      '/api/auth'
    ]

    // Check if route is public
    if (publicRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next()
    }

    // Portal routes require authentication
    if (pathname.startsWith('/portal')) {
      if (!token) {
        const url = new URL('/auth/signin', req.url)
        url.searchParams.set('callbackUrl', req.url)
        return NextResponse.redirect(url)
      }

      // Additional permission checks can be added here
      // For now, any authenticated user can access the portal
      // Feature-specific permissions are handled at component level
      return NextResponse.next()
    }

    // Admin routes (future implementation)
    if (pathname.startsWith('/admin')) {
      if (!token || token.accessLevel !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Allow public routes
        const publicRoutes = [
          '/',
          '/assessment',
          '/breath',
          '/process',
          '/auth/signin',
          '/auth/error'
        ]

        if (publicRoutes.some(route => pathname.startsWith(route))) {
          return true
        }

        // Require authentication for other routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
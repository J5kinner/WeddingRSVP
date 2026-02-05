import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BASIC_REALM = 'RSVP Admin'
const adminUsername = process.env.ADMIN_USERNAME
const adminPassword = process.env.ADMIN_PASSWORD
const adminToken = process.env.ADMIN_TOKEN

function isBasicAuthValid(authorization: string): boolean {
  if (!authorization.startsWith('Basic ') || !adminUsername || !adminPassword) {
    return false
  }

  try {
    const base64Credentials = authorization.replace('Basic ', '')
    const decoded = atob(base64Credentials)
    const separatorIndex = decoded.indexOf(':')

    if (separatorIndex === -1) {
      return false
    }

    const username = decoded.slice(0, separatorIndex)
    const password = decoded.slice(separatorIndex + 1)

    return username === adminUsername && password === adminPassword
  } catch {
    return false
  }
}

function isAuthorized(request: NextRequest): boolean {
  const authorization = request.headers.get('authorization')

  if (!authorization) {
    return false
  }

  if (adminToken && authorization === `Bearer ${adminToken}`) {
    return true
  }

  return isBasicAuthValid(authorization)
}

export function middleware(request: NextRequest) {
  const isProduction = process.env.VERCEL_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')

  if (!isAdminPath) {
    return NextResponse.next()
  }

  // 1. Disable admin page for production builds
  if (isProduction) {
    return new NextResponse(null, { status: 404 })
  }

  // 2. For non-production environments (Preview or Local Dev):
  // Check if credentials are configured
  const credentialsConfigured = Boolean(
    (adminUsername && adminPassword) || adminToken
  )

  // If we are in local development and no credentials are set, allow access
  // This makes local development easier.
  if (isDevelopment && !credentialsConfigured) {
    return NextResponse.next()
  }

  if (!credentialsConfigured) {
    return new NextResponse('Admin access is not configured for this environment', { status: 503 })
  }

  if (isAuthorized(request)) {
    return NextResponse.next()
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${BASIC_REALM}"`,
    },
  })
}

export const config = {
  matcher: ['/admin/:path*'],
}

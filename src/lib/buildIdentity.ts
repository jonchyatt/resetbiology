const FULL_SHA = /^[0-9a-f]{40}$/i

export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.BUILD_SHA ?? 'unknown'

if (process.env.NODE_ENV === 'production' && !FULL_SHA.test(BUILD_SHA)) {
  throw new Error(`Invalid deployed build identity: ${BUILD_SHA}`)
}
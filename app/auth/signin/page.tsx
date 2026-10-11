import { redirect } from "next/navigation"

// Retired sign-in page (kept as LegacySignInPage.tsx). Auth0 login is the one door.
export default function SignInPage() {
  redirect("/auth/login")
}

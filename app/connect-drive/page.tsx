import { redirect } from "next/navigation"
import { auth0 } from "@/lib/auth0"
import { ConnectDriveSetup } from "@/components/Vault/ConnectDriveSetup"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Vault Setup — Reset Biology",
  description:
    "Connect your Google Drive to enable peptide tracking, dose reminders, and personalized coaching. You own your data.",
}

export default async function ConnectDrivePage() {
  const session = await auth0.getSession()

  if (!session) {
    redirect("/auth/login?returnTo=/connect-drive")
  }

  return <ConnectDriveSetup />
}

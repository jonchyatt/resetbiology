// Friendly text for a failed Google Drive connect, shared by /connect-drive and /profile.
export const DRIVE_SCOPE_MISSING_MESSAGE =
  "Google asked which access to share and the Google Drive box was left unticked. Try again and tick the Drive box so we can save your files there."
export const DRIVE_CALLBACK_FAILED_MESSAGE =
  "Google didn't finish connecting this time. This usually clears up on a second try."
export const DRIVE_GENERIC_ERROR_MESSAGE = "Something went wrong connecting Drive. Try again or contact support."

export function driveErrorMessage(reason: string | null | undefined): string {
  if (reason === "drive_scope_missing") return DRIVE_SCOPE_MISSING_MESSAGE
  if (reason === "callback_failed") return DRIVE_CALLBACK_FAILED_MESSAGE
  return DRIVE_GENERIC_ERROR_MESSAGE
}

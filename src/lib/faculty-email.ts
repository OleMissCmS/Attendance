export const INVALID_EMAIL_MESSAGE = "invalid email address"

/** Faculty self-registration: @olemiss.edu only (not @go.olemiss.edu). */
export function isFacultyEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return normalized.endsWith("@olemiss.edu") && !normalized.endsWith("@go.olemiss.edu")
}

export function signupErrorMessage(errorMessage: string, email: string) {
  if (!isFacultyEmail(email) || /invalid email/i.test(errorMessage)) {
    return INVALID_EMAIL_MESSAGE
  }
  return errorMessage
}

export function hasFacultyAppAccess(role: string) {
  return role === "faculty" || role === "guest"
}

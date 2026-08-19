// PRODUCTION: set NEXT_PUBLIC_TEST_MODE=false and ALLOW_TEST_STUDENT=false
// (or remove them). Test@test.com check-in and clickable QR must not ship enabled.

const TEST_STUDENT_EMAIL = "test@test.com"

export function isTestMode() {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true"
}

export function isTestStudentBypassEnabled() {
  return (
    process.env.ALLOW_TEST_STUDENT === "true" ||
    process.env.NEXT_PUBLIC_TEST_MODE === "true"
  )
}

export function isTestStudentEmail(email: string) {
  return email.trim().toLowerCase() === TEST_STUDENT_EMAIL
}

export function allowTestStudentCheckIn(email: string) {
  return isTestStudentBypassEnabled() && isTestStudentEmail(email)
}

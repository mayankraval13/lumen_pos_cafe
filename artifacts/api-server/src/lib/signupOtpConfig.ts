/** Single email allowed to sign up; must complete email OTP (Resend). Keep in sync with Signup.tsx UX. */
export const SIGNUP_OTP_ALLOWED_EMAIL = "iammayankraval@gmail.com";

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOtpSignupEmail(email: string): boolean {
  return normalizeSignupEmail(email) === SIGNUP_OTP_ALLOWED_EMAIL;
}

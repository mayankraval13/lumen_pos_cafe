import { normalizeSignupEmail } from "./signupOtpConfig";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_OTP_REQUESTS_PER_WINDOW = 8;

type OtpEntry = { code: string; expiresAt: number };

const otpByEmail = new Map<string, OtpEntry>();
const rateByEmail = new Map<string, { count: number; windowStart: number }>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, v] of otpByEmail) {
    if (now > v.expiresAt) otpByEmail.delete(key);
  }
}

export function canRequestOtp(email: string): { ok: true } | { ok: false; reason: string } {
  const key = normalizeSignupEmail(email);
  const now = Date.now();
  let r = rateByEmail.get(key);
  if (!r || now - r.windowStart > RATE_WINDOW_MS) {
    r = { count: 0, windowStart: now };
    rateByEmail.set(key, r);
  }
  if (r.count >= MAX_OTP_REQUESTS_PER_WINDOW) {
    return { ok: false, reason: "Too many code requests. Try again later." };
  }
  return { ok: true };
}

export function recordOtpRequest(email: string): void {
  const key = normalizeSignupEmail(email);
  const now = Date.now();
  let r = rateByEmail.get(key);
  if (!r || now - r.windowStart > RATE_WINDOW_MS) {
    r = { count: 0, windowStart: now };
  }
  r.count += 1;
  rateByEmail.set(key, r);
}

export function createAndStoreOtp(email: string): string {
  pruneExpired();
  const key = normalizeSignupEmail(email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpByEmail.set(key, { code, expiresAt: Date.now() + OTP_TTL_MS });
  return code;
}

/** Returns true if code matches and removes the OTP (one-time use). */
export function verifyAndConsumeOtp(email: string, code: string): boolean {
  const key = normalizeSignupEmail(email);
  const entry = otpByEmail.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpByEmail.delete(key);
    return false;
  }
  if (entry.code !== code.trim()) return false;
  otpByEmail.delete(key);
  return true;
}

export function deleteOtp(email: string): void {
  otpByEmail.delete(normalizeSignupEmail(email));
}

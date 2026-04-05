/** Normalize JSON bodies whether the client sent `{ email }` or accidentally `{ data: { email } }`. */

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function readEmailFromRequestBody(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const direct = body.email;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (isRecord(body.data) && typeof body.data.email === "string" && body.data.email.trim()) {
    return body.data.email;
  }
  return undefined;
}

export function readSignupPayload(body: unknown): {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  otp?: string;
} {
  if (!isRecord(body)) return {};
  const src = isRecord(body.data) ? body.data : body;
  const s = (k: string): string | undefined => {
    const v = src[k];
    return typeof v === "string" ? v : undefined;
  };
  return {
    name: s("name"),
    email: s("email"),
    password: s("password"),
    role: s("role"),
    otp: s("otp"),
  };
}

import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, verifyToken, type AuthRequest } from "../middlewares/auth";
import { isOtpSignupEmail, normalizeSignupEmail } from "../lib/signupOtpConfig";
import {
  canRequestOtp,
  createAndStoreOtp,
  deleteOtp,
  recordOtpRequest,
  verifyAndConsumeOtp,
} from "../lib/signupOtpStore";
import { sendSignupOtpEmail } from "../lib/sendSignupOtpEmail";
import { logger } from "../lib/logger";
import { readEmailFromRequestBody, readSignupPayload } from "../lib/parseAuthJsonBody";

const router: IRouter = Router();

router.post("/auth/signup/request-otp", async (req, res): Promise<void> => {
  const emailRaw = readEmailFromRequestBody(req.body);

  if (!emailRaw?.trim()) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn(
        {
          contentType: req.headers["content-type"],
          bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body as object) : [],
        },
        "request-otp: missing email in JSON body",
      );
    }
    res.status(400).json({ error: "email is required" });
    return;
  }

  const emailNorm = normalizeSignupEmail(emailRaw);
  if (!isOtpSignupEmail(emailNorm)) {
    res.status(403).json({ error: "Sign up is not available for this email address" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({
      error: "An account with this email already exists. Use Sign in with password on the login page.",
    });
    return;
  }

  const rate = canRequestOtp(emailNorm);
  if (!rate.ok) {
    res.status(429).json({ error: rate.reason });
    return;
  }

  const code = createAndStoreOtp(emailNorm);
  recordOtpRequest(emailNorm);

  if (process.env.SIGNUP_OTP_DEV_LOG === "true" && process.env.NODE_ENV !== "production") {
    logger.warn({ email: emailNorm, code }, "DEV SIGNUP_OTP_DEV_LOG: OTP (Resend free tier / local testing)");
  }

  try {
    await sendSignupOtpEmail(emailNorm, code);
  } catch (e) {
    deleteOtp(emailNorm);
    res.status(503).json({ error: e instanceof Error ? e.message : "Could not send verification email" });
    return;
  }

  res.json({ ok: true });
});

router.post("/auth/signup", async (req, res): Promise<void> => {
  const { name, email, password, role, otp } = readSignupPayload(req.body);

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }

  const emailNorm = normalizeSignupEmail(email);
  if (!isOtpSignupEmail(emailNorm)) {
    res.status(403).json({ error: "Sign up is not available for this email address" });
    return;
  }

  if (!otp || typeof otp !== "string" || !otp.trim()) {
    res.status(400).json({ error: "Verification code is required" });
    return;
  }

  if (!verifyAndConsumeOtp(emailNorm, otp)) {
    res.status(400).json({ error: "Invalid or expired verification code" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email: emailNorm,
      password: hashed,
      role: (role === "ADMIN" ? "ADMIN" : role === "WAITER" ? "WAITER" : "CASHIER") as "ADMIN" | "CASHIER" | "WAITER",
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const token = generateToken(user.id, user.role);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const emailNorm = normalizeSignupEmail(email);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken(user.id, user.role);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", verifyToken, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedTableIds: JSON.parse(user.assignedTableIds || '[]') as string[],
    createdAt: user.createdAt,
  });
});

export default router;

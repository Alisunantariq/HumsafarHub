const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { Role, ApprovalStatus, SubscriptionStatus } = require("@prisma/client");
const prisma = require("../db");
const { authenticate } = require("../middleware/auth");
const {
  getUserSubscription,
  getSubscriptionAccess,
  isSubscriptionTestMode,
} = require("../services/subscription-access");

const router = Router();
const LEGAL_VERSION = "2026-10-19-v2";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    approvalStatus: user.approvalStatus,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlan: user.subscriptionPlan,
  };
}

async function userWithSubscription(user) {
  const subscription = await getUserSubscription(user.id);
  return {
    ...publicUser(user),
    subscriptionAccess: await getSubscriptionAccess(user, subscription),
    subscriptionTestMode: isSubscriptionTestMode() && user.role === Role.MATCHMAKER,
    subscriptionState: subscription?.status || null,
    subscriptionGracePeriodEndsAt: subscription?.gracePeriodEndsAt || null,
    subscriptionCurrentPeriodEnd: subscription?.currentPeriodEnd || null,
  };
}

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        approvalStatus: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        createdAt: true,
      },
    });
    return res.json({ user: await userWithSubscription(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, fullName, phoneNumber, dateOfBirth, legalAccepted } = req.body || {};
    const validDateOfBirth = typeof dateOfBirth === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
      !Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00.000Z`)) &&
      new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) === dateOfBirth;
    const latestAdultBirthDate = new Date();
    latestAdultBirthDate.setUTCFullYear(latestAdultBirthDate.getUTCFullYear() - 18);
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      typeof fullName !== "string" ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 160 ||
      typeof phoneNumber !== "string" ||
      phoneNumber.trim().length < 7 ||
      phoneNumber.trim().length > 40 ||
      !/^[+0-9().\-\s]+$/.test(phoneNumber.trim()) ||
      phoneNumber.replace(/\D/g, "").length < 7 ||
      !validDateOfBirth ||
      new Date(`${dateOfBirth}T00:00:00.000Z`) > latestAdultBirthDate ||
      legalAccepted !== true
    ) {
      return res.status(400).json({
        error: "Provide valid account details, confirm you are at least 18, and accept the current Terms and Conditions and Privacy Policy.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
        legalAcceptedAt: new Date(),
        legalVersion: LEGAL_VERSION,
        role: Role.MATCHMAKER,
        approvalStatus: ApprovalStatus.PENDING,
        subscriptionStatus: SubscriptionStatus.INACTIVE,
      },
    });

    return res.status(201).json({
      user: publicUser(user),
      message: isSubscriptionTestMode()
        ? "Registration received. Free testing access is enabled; administrator approval is still required."
        : "Registration received. Account approval and an active subscription are required for platform access.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !passwordMatches || !user.isActive) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    });
    return res.json({ token, user: await userWithSubscription(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

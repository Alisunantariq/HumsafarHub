const jwt = require("jsonwebtoken");
const prisma = require("../db");
const { getUserSubscription, getSubscriptionAccess } = require("../services/subscription-access");

async function authenticate(req, res, next) {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof claims !== "object" || typeof claims.sub !== "string") {
      return res.status(401).json({ error: "Invalid authentication token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        role: true,
        approvalStatus: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Account is unavailable." });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Invalid or expired authentication token." });
    }
    return next(error);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    return next();
  };
}

async function requirePlatformAccess(req, res, next) {
  if (req.user?.role === "ADMIN") return next();
  if (req.user?.role !== "MATCHMAKER") {
    return res.status(403).json({ error: "Matchmaker access is required." });
  }
  if (req.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ error: "Your matchmaker account is awaiting approval." });
  }
  try {
    const subscription = await getUserSubscription(req.user.id);
    const hasAccess = await getSubscriptionAccess(req.user, subscription);
    if (!hasAccess) {
      const message = subscription?.status === "PAST_DUE"
        ? "Your payment grace period has expired. Update your billing to restore access."
        : "An active subscription is required.";
      return res.status(403).json({ error: message });
    }
    req.user.subscription = subscription;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate, requireRoles, requirePlatformAccess };

const { Router } = require("express");
const { ApprovalStatus, Role } = require("@prisma/client");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");

const router = Router();
router.use(authenticate, requireRoles(Role.ADMIN));

router.get("/summary", async (req, res, next) => {
  try {
    const [matchmakers, profiles, pendingApprovals, pendingCheckouts] = await Promise.all([
      prisma.user.count({ where: { role: Role.MATCHMAKER } }),
      prisma.clientProfile.count(),
      prisma.user.count({ where: { role: Role.MATCHMAKER, approvalStatus: ApprovalStatus.PENDING } }),
      prisma.subscription.findMany({
        where: { status: "PENDING", checkoutStatus: "READY" },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);
    return res.json({
      summary: {
        matchmakers,
        profiles,
        pendingApprovals,
        pendingPayments: pendingCheckouts.length,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/matchmakers", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: Role.MATCHMAKER },
      select: {
        id: true,
        email: true,
        fullName: true,
        approvalStatus: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        createdAt: true,
        _count: { select: { profiles: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ matchmakers: users });
  } catch (error) {
    return next(error);
  }
});

router.patch("/matchmakers/:id", async (req, res, next) => {
  try {
    const { approvalStatus } = req.body || {};
    if (![ApprovalStatus.APPROVED, ApprovalStatus.REJECTED].includes(approvalStatus)) {
      return res.status(400).json({ error: "approvalStatus must be APPROVED or REJECTED." });
    }
    const result = await prisma.user.updateMany({
      where: { id: req.params.id, role: Role.MATCHMAKER },
      data: { approvalStatus },
    });
    if (!result.count) return res.status(404).json({ error: "Matchmaker account not found." });
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, fullName: true, approvalStatus: true, subscriptionStatus: true, subscriptionPlan: true },
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

router.get("/profiles", async (req, res, next) => {
  try {
    const profiles = await prisma.clientProfile.findMany({
      select: {
        id: true,
        matchmakerId: true,
        fullName: true,
        gender: true,
        dateOfBirth: true,
        heightCm: true,
        propertyMarlas: true,
        education: true,
        profession: true,
        maritalStatus: true,
        caste: true,
        city: true,
        contactPhone: true,
        contactEmail: true,
        createdAt: true,
        matchmaker: { select: { fullName: true, phoneNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return res.json({ profiles });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

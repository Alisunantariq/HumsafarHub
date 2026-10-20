const { Router } = require("express");
const { CoordinationStatus } = require("@prisma/client");
const prisma = require("../db");
const { authenticate, requirePlatformAccess } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const requests = await prisma.coordinationRequest.findMany({
      where: req.user.role === "ADMIN"
        ? {}
        : { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
      include: {
        sender: { select: { id: true, fullName: true } },
        receiver: { select: { id: true, fullName: true } },
        targetProfile: {
          select: {
            id: true,
            fullName: true,
            city: true,
            caste: true,
            education: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ requests });
  } catch (error) {
    return next(error);
  }
});

router.post("/request", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const { targetProfileId } = req.body || {};
    if (typeof targetProfileId !== "string") {
      return res.status(400).json({ error: "targetProfileId is required." });
    }

    const profile = await prisma.clientProfile.findUnique({
      where: { id: targetProfileId },
      select: { id: true, matchmakerId: true, isVisible: true },
    });
    if (!profile || !profile.isVisible) return res.status(404).json({ error: "Profile not found." });
    if (profile.matchmakerId === req.user.id) {
      return res.status(400).json({ error: "You cannot request coordination for your own profile." });
    }

    const existing = await prisma.coordinationRequest.findFirst({
      where: {
        senderId: req.user.id,
        targetProfileId,
        status: { in: [CoordinationStatus.PENDING, CoordinationStatus.APPROVED] },
      },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ error: "An active coordination request already exists." });

    const request = await prisma.coordinationRequest.create({
      data: {
        senderId: req.user.id,
        receiverId: profile.matchmakerId,
        targetProfileId: profile.id,
      },
    });
    return res.status(201).json({ request });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (![CoordinationStatus.APPROVED, CoordinationStatus.DECLINED, CoordinationStatus.WITHDRAWN].includes(status)) {
      return res.status(400).json({ error: "status must be APPROVED, DECLINED, or WITHDRAWN." });
    }

    const request = await prisma.coordinationRequest.findUnique({
      where: { id: req.params.id },
      include: {
        targetProfile: {
          select: { id: true, contactPhone: true, contactEmail: true },
        },
      },
    });
    if (!request) return res.status(404).json({ error: "Coordination request not found." });
    if (request.status !== CoordinationStatus.PENDING) {
      return res.status(409).json({ error: "Only pending requests can be updated." });
    }

    const isReceiverAction = status === CoordinationStatus.APPROVED || status === CoordinationStatus.DECLINED;
    if ((isReceiverAction && request.receiverId !== req.user.id) ||
        (status === CoordinationStatus.WITHDRAWN && request.senderId !== req.user.id)) {
      return res.status(403).json({ error: "You are not permitted to update this request." });
    }

    const updatedCount = await prisma.coordinationRequest.updateMany({
      where: {
        id: request.id,
        status: CoordinationStatus.PENDING,
        ...(isReceiverAction ? { receiverId: req.user.id } : { senderId: req.user.id }),
      },
      data: {
        status,
        respondedAt: new Date(),
      },
    });
    if (updatedCount.count !== 1) {
      return res.status(409).json({ error: "The request has already been updated." });
    }

    const updated = await prisma.coordinationRequest.findUnique({
      where: { id: request.id },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        targetProfileId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        respondedAt: true,
      },
    });
    return res.json({
      request: updated,
      message: status === CoordinationStatus.APPROVED
        ? "Request approved. Contact details are now available to the requesting matchmaker through the profile detail endpoint."
        : `Request ${status.toLowerCase()}.`,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, requirePlatformAccess } = require("../middleware/auth");
const { evaluateMatch } = require("../services/matching");

const router = Router();

router.get("/:sourceProfileId/:candidateProfileId/photo", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const source = await prisma.clientProfile.findUnique({
      where: { id: req.params.sourceProfileId },
    });
    if (!source || !source.isVisible) return res.status(404).json({ error: "Profile not found." });
    if (req.user.role !== "ADMIN" && source.matchmakerId !== req.user.id) {
      return res.status(403).json({ error: "You may only view match photos for profiles you manage." });
    }

    const profile = await prisma.clientProfile.findFirst({
      where: {
        id: req.params.candidateProfileId,
        isVisible: true,
        matchmaker: { is: { subscriptionPlan: "NORMAL" } },
        ...(req.user.role === "MATCHMAKER" && req.user.subscriptionPlan === "NORMAL"
          ? { clientOrigin: "PAKISTAN" }
          : {}),
      },
      select: {
        id: true,
        gender: true,
        dateOfBirth: true,
        heightCm: true,
        propertyMarlas: true,
        education: true,
        caste: true,
        city: true,
        preferredCaste: true,
        preferredMinAge: true,
        preferredMaxAge: true,
        preferredCity: true,
        preferredEducation: true,
        preferredMinHeightCm: true,
        preferredMaxHeightCm: true,
        photoData: true,
        photoMimeType: true,
      },
    });
    if (!profile || !profile.photoData || !profile.photoMimeType) {
      return res.status(404).json({ error: "Profile photo not found." });
    }
    if (!evaluateMatch(source, profile)) {
      return res.status(404).json({ error: "Profile photo not found." });
    }
    res.set({
      "Content-Type": profile.photoMimeType,
      "Content-Length": profile.photoData.length,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(profile.photoData);
  } catch (error) {
    return next(error);
  }
});

router.get("/:profileId", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const source = await prisma.clientProfile.findUnique({
      where: { id: req.params.profileId },
    });
    if (!source || !source.isVisible) return res.status(404).json({ error: "Profile not found." });
    if (req.user.role !== "ADMIN" && source.matchmakerId !== req.user.id) {
      return res.status(403).json({ error: "You may only run matching for profiles you manage." });
    }

    const candidates = await prisma.clientProfile.findMany({
      where: {
        isVisible: true,
        id: { not: source.id },
        matchmaker: { is: { subscriptionPlan: "NORMAL" } },
        ...(req.user.role === "MATCHMAKER" && req.user.subscriptionPlan === "NORMAL"
          ? { clientOrigin: "PAKISTAN" }
          : {}),
      },
      select: {
        id: true,
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
        preferredCaste: true,
        preferredMinAge: true,
        preferredMaxAge: true,
        preferredCity: true,
        preferredEducation: true,
        preferredMinHeightCm: true,
        preferredMaxHeightCm: true,
        incomeMin: true,
        incomeMax: true,
        maritalHistory: true,
        clientOrigin: true,
        preferences: true,
        description: true,
        requirements: true,
        createdAt: true,
        photoMimeType: true,
        matchmaker: {
          select: {
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    const results = candidates
      .map((candidate) => {
        const evaluation = evaluateMatch(source, candidate);
        if (!evaluation) return null;
        const publicCandidate = { ...candidate };
        delete publicCandidate.matchmakerId;
        delete publicCandidate.contactPhone;
        delete publicCandidate.contactEmail;
        delete publicCandidate.photoData;
        return { ...publicCandidate, ...evaluation };
      })
      .filter(Boolean);
    results.sort((first, second) =>
      second.compatibilityPercent - first.compatibilityPercent ||
      first.fullName.localeCompare(second.fullName),
    );
    return res.json({ profileId: source.id, matches: results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

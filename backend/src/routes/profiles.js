const { Router } = require("express");
const multer = require("multer");
const { MaritalStatus } = require("@prisma/client");
const prisma = require("../db");
const { authenticate, requirePlatformAccess } = require("../middleware/auth");

const router = Router();
const MAX_PROFILE_PHOTO_SIZE = 3 * 1024 * 1024;
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_SIZE, files: 1, fields: 50, fieldSize: 8 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(new Error("Client photo must be a JPEG, PNG, or WebP image."));
    }
    return callback(null, true);
  },
});
const maritalHistoryOptions = new Set([
  "Single",
  "Divorced",
  "Widow",
  "Divorced with children",
  "Widow with children",
]);
const profileFields = {
  id: true,
  matchmakerId: true,
  fullName: true,
  gender: true,
  dateOfBirth: true,
  heightCm: true,
  propertyMarlas: true,
  education: true,
  profession: true,
  incomeMin: true,
  incomeMax: true,
  maritalStatus: true,
  maritalHistory: true,
  caste: true,
  city: true,
  preferredCaste: true,
  preferredMinAge: true,
  preferredMaxAge: true,
  preferredCity: true,
  preferredEducation: true,
  preferredMinHeightCm: true,
  preferredMaxHeightCm: true,
  clientOrigin: true,
  preferences: true,
  description: true,
  requirements: true,
  photoMimeType: true,
  createdAt: true,
};

const publicProfileFields = {
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
  clientOrigin: true,
  createdAt: true,
};

function parseNumber(value, name) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid number.`);
  return parsed;
}

function ageToDate(age) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - age);
  return date;
}

function parsePhotoUpload(req, res, next) {
  photoUpload.single("photo")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "Client photo must be 3 MB or smaller."
          : "Upload one valid client photo.",
      });
    }
    return res.status(400).json({ error: error.message });
  });
}

function isValidPhoto(file) {
  if (!file) return false;
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === "image/png") {
    return bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === "image/webp") {
    return bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

router.get("/", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const { caste, city, education, minAge, maxAge, propertyMinMarlas, propertyMaxMarlas } = req.query;
    const min = parseNumber(minAge, "minAge");
    const max = parseNumber(maxAge, "maxAge");
    const propertyMin = parseNumber(propertyMinMarlas, "propertyMinMarlas");
    const propertyMax = parseNumber(propertyMaxMarlas, "propertyMaxMarlas");
    for (const [name, value] of Object.entries({ caste, city, education })) {
      if (value !== undefined && typeof value !== "string") {
        return res.status(400).json({ error: `${name} must be a single text value.` });
      }
    }

    if (
      (min !== undefined && (!Number.isInteger(min) || min < 18 || min > 120)) ||
      (max !== undefined && (!Number.isInteger(max) || max < 18 || max > 120)) ||
      (min !== undefined && max !== undefined && min > max)
    ) {
      return res.status(400).json({ error: "Age filters must be whole years from 18 to 120 and minAge cannot exceed maxAge." });
    }
    if ((propertyMin !== undefined && propertyMin < 0) || (propertyMax !== undefined && propertyMax < 0) ||
        (propertyMin !== undefined && propertyMax !== undefined && propertyMin > propertyMax)) {
      return res.status(400).json({ error: "Property filters must be non-negative and the minimum cannot exceed the maximum." });
    }

    const where = { isVisible: true };
    if (req.user.role === "MATCHMAKER" && req.user.subscriptionPlan === "NORMAL") {
      where.clientOrigin = "PAKISTAN";
    }
    if (caste) where.caste = { contains: String(caste), mode: "insensitive" };
    if (city) where.city = { contains: String(city), mode: "insensitive" };
    if (education) where.education = { contains: String(education), mode: "insensitive" };
    if (min !== undefined || max !== undefined) {
      where.dateOfBirth = {};
      if (min !== undefined) where.dateOfBirth.lte = ageToDate(min);
      if (max !== undefined) where.dateOfBirth.gte = ageToDate(max + 1);
    }
    if (propertyMin !== undefined || propertyMax !== undefined) {
      where.propertyMarlas = {};
      if (propertyMin !== undefined) where.propertyMarlas.gte = propertyMin;
      if (propertyMax !== undefined) where.propertyMarlas.lte = propertyMax;
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
    const [profiles, total] = await Promise.all([
      prisma.clientProfile.findMany({
        where,
        select: publicProfileFields,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.clientProfile.count({ where }),
    ]);
    return res.json({ profiles, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && /must be a valid number/.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

router.get("/mine", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const profiles = await prisma.clientProfile.findMany({
      where: req.user.role === "ADMIN" ? {} : { matchmakerId: req.user.id },
      select: {
        ...profileFields,
        contactPhone: true,
        contactEmail: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ profiles });
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, requirePlatformAccess, parsePhotoUpload, async (req, res, next) => {
  try {
    const {
      fullName, gender, dateOfBirth, heightCm, propertyMarlas, education,
      profession, incomeMin, incomeMax, maritalStatus, maritalHistory,
      caste, city, contactPhone, contactEmail, preferredCaste,
      preferredMinAge, preferredMaxAge, preferredCity, preferredEducation,
      preferredMinHeightCm, preferredMaxHeightCm,
      clientOrigin, preferences, description, requirements,
    } = req.body || {};
    if (!req.file) {
      return res.status(400).json({ error: "A client photo is required." });
    }
    if (!isValidPhoto(req.file)) {
      return res.status(400).json({ error: "Client photo content is not a valid JPEG, PNG, or WebP image." });
    }
    const validDate = typeof dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
      !Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00.000Z`)) &&
      new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) === dateOfBirth;
    const numericHeight = Number(heightCm);
    const property = Number(propertyMarlas);
    const allowedMaritalStatuses = Object.values(MaritalStatus);
    const normalizedClientOrigin = typeof clientOrigin === "string"
      ? clientOrigin.trim().toUpperCase()
      : "PAKISTAN";
    const latestAdultBirthDate = new Date();
    latestAdultBirthDate.setUTCFullYear(latestAdultBirthDate.getUTCFullYear() - 18);
    const optionalTextIsValid = (value, maxLength) =>
      value == null || (typeof value === "string" && value.length <= maxLength);

    if (
      typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 160 ||
      typeof gender !== "string" || !gender.trim() || gender.length > 40 ||
      !validDate || new Date(`${dateOfBirth}T00:00:00.000Z`) > latestAdultBirthDate ||
      !Number.isInteger(numericHeight) || numericHeight < 80 || numericHeight > 250 ||
      !Number.isFinite(property) || property < 0 ||
      typeof education !== "string" || !education.trim() || education.length > 160 ||
      !allowedMaritalStatuses.includes(maritalStatus) ||
      !maritalHistoryOptions.has(maritalHistory) ||
      typeof caste !== "string" || !caste.trim() || caste.length > 120 ||
      typeof city !== "string" || !city.trim() || city.length > 120 ||
      typeof contactPhone !== "string" || !contactPhone.trim() || contactPhone.length > 40 ||
      (incomeMin !== undefined && incomeMin !== null && (!Number.isFinite(Number(incomeMin)) || Number(incomeMin) < 0)) ||
      (incomeMax !== undefined && incomeMax !== null && (!Number.isFinite(Number(incomeMax)) || Number(incomeMax) < 0)) ||
      (incomeMin != null && incomeMax != null && Number(incomeMin) > Number(incomeMax)) ||
      !optionalTextIsValid(profession, 160) ||
      !optionalTextIsValid(maritalHistory, 1000) ||
      !optionalTextIsValid(contactEmail, 320) ||
      (contactEmail != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) ||
      !optionalTextIsValid(preferredCaste, 120) ||
      !optionalTextIsValid(preferredCity, 120) ||
      !optionalTextIsValid(preferredEducation, 160) ||
      !optionalTextIsValid(clientOrigin, 80) ||
      !optionalTextIsValid(preferences, 1000) ||
      !optionalTextIsValid(description, 2000) ||
      !optionalTextIsValid(requirements, 2000) ||
      (preferredMinHeightCm != null && (!Number.isInteger(Number(preferredMinHeightCm)) || Number(preferredMinHeightCm) < 80 || Number(preferredMinHeightCm) > 250)) ||
      (preferredMaxHeightCm != null && (!Number.isInteger(Number(preferredMaxHeightCm)) || Number(preferredMaxHeightCm) < 80 || Number(preferredMaxHeightCm) > 250)) ||
      (preferredMinHeightCm != null && preferredMaxHeightCm != null && Number(preferredMinHeightCm) > Number(preferredMaxHeightCm)) ||
      (preferredMinAge != null && (!Number.isInteger(Number(preferredMinAge)) || Number(preferredMinAge) < 18 || Number(preferredMinAge) > 120)) ||
      (preferredMaxAge != null && (!Number.isInteger(Number(preferredMaxAge)) || Number(preferredMaxAge) < 18 || Number(preferredMaxAge) > 120)) ||
      (preferredMinAge != null && preferredMaxAge != null && Number(preferredMinAge) > Number(preferredMaxAge))
    ) {
      return res.status(400).json({ error: "Profile data is invalid. Check required fields, dates, ages, heights, income, and marital status." });
    }
    if (
      req.user.role === "MATCHMAKER" &&
      req.user.subscriptionPlan === "NORMAL" &&
      normalizedClientOrigin !== "PAKISTAN"
    ) {
      return res.status(403).json({ error: "The Normal plan can create Pakistan-based profiles only." });
    }

    const profile = await prisma.clientProfile.create({
      data: {
        matchmakerId: req.user.id,
        fullName: fullName.trim(),
        gender: gender.trim(),
        dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
        heightCm: numericHeight,
        propertyMarlas: property,
        education: education.trim(),
        profession: profession?.trim() || null,
        incomeMin: incomeMin == null ? null : Number(incomeMin),
        incomeMax: incomeMax == null ? null : Number(incomeMax),
        maritalStatus,
        maritalHistory: maritalHistory?.trim() || null,
        caste: caste.trim(),
        city: city.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail?.trim() || null,
        preferredCaste: preferredCaste?.trim() || null,
        preferredMinAge: preferredMinAge == null ? null : Number(preferredMinAge),
        preferredMaxAge: preferredMaxAge == null ? null : Number(preferredMaxAge),
        preferredCity: preferredCity?.trim() || null,
        preferredEducation: preferredEducation?.trim() || null,
        preferredMinHeightCm: preferredMinHeightCm == null ? null : Number(preferredMinHeightCm),
        preferredMaxHeightCm: preferredMaxHeightCm == null ? null : Number(preferredMaxHeightCm),
        clientOrigin: normalizedClientOrigin,
        preferences: preferences?.trim() || null,
        description: description?.trim() || null,
        requirements: requirements?.trim() || null,
        photoData: req.file.buffer,
        photoMimeType: req.file.mimetype,
      },
      select: { ...profileFields, contactPhone: true, contactEmail: true },
    });
    return res.status(201).json({ profile });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", authenticate, requirePlatformAccess, parsePhotoUpload, async (req, res, next) => {
  try {
    if (req.user.role !== "MATCHMAKER") {
      return res.status(403).json({ error: "Only consultants can update client profiles." });
    }
    const existing = await prisma.clientProfile.findFirst({
      where: { id: req.params.id, matchmakerId: req.user.id },
      select: { ...profileFields, matchmakerId: true, contactPhone: true, contactEmail: true },
    });
    if (!existing) return res.status(404).json({ error: "Client profile not found." });

    const mergedData = { ...existing, ...req.body };
    for (const field of [
      "profession",
      "incomeMin",
      "incomeMax",
      "contactEmail",
      "preferredCaste",
      "preferredMinAge",
      "preferredMaxAge",
      "preferredCity",
      "preferredEducation",
      "preferredMinHeightCm",
      "preferredMaxHeightCm",
      "preferences",
      "description",
      "requirements",
    ]) {
      if (mergedData[field] === "") mergedData[field] = null;
    }
    if (mergedData.dateOfBirth instanceof Date) {
      mergedData.dateOfBirth = mergedData.dateOfBirth.toISOString().slice(0, 10);
    }
    const {
      fullName, gender, dateOfBirth, heightCm, propertyMarlas, education,
      profession, incomeMin, incomeMax, maritalStatus, maritalHistory,
      caste, city, contactPhone, contactEmail, preferredCaste,
      preferredMinAge, preferredMaxAge, preferredCity, preferredEducation,
      preferredMinHeightCm, preferredMaxHeightCm,
      clientOrigin, preferences, description, requirements,
    } = mergedData;
    if (req.file && !isValidPhoto(req.file)) {
      return res.status(400).json({ error: "Client photo content is not a valid JPEG, PNG, or WebP image." });
    }
    const validDate = typeof dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
      !Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00.000Z`)) &&
      new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) === dateOfBirth;
    const numericHeight = Number(heightCm);
    const property = Number(propertyMarlas);
    const normalizedClientOrigin = typeof clientOrigin === "string"
      ? clientOrigin.trim().toUpperCase()
      : "PAKISTAN";
    const latestAdultBirthDate = new Date();
    latestAdultBirthDate.setUTCFullYear(latestAdultBirthDate.getUTCFullYear() - 18);
    const optionalTextIsValid = (value, maxLength) =>
      value == null || (typeof value === "string" && value.length <= maxLength);

    if (
      typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 160 ||
      typeof gender !== "string" || !gender.trim() || gender.length > 40 ||
      !validDate || new Date(`${dateOfBirth}T00:00:00.000Z`) > latestAdultBirthDate ||
      !Number.isInteger(numericHeight) || numericHeight < 80 || numericHeight > 250 ||
      !Number.isFinite(property) || property < 0 ||
      typeof education !== "string" || !education.trim() || education.length > 160 ||
      !Object.values(MaritalStatus).includes(maritalStatus) ||
      !maritalHistoryOptions.has(maritalHistory) ||
      typeof caste !== "string" || !caste.trim() || caste.length > 120 ||
      typeof city !== "string" || !city.trim() || city.length > 120 ||
      typeof contactPhone !== "string" || !contactPhone.trim() || contactPhone.length > 40 ||
      (incomeMin != null && (!Number.isFinite(Number(incomeMin)) || Number(incomeMin) < 0)) ||
      (incomeMax != null && (!Number.isFinite(Number(incomeMax)) || Number(incomeMax) < 0)) ||
      (incomeMin != null && incomeMax != null && Number(incomeMin) > Number(incomeMax)) ||
      !optionalTextIsValid(profession, 160) ||
      !optionalTextIsValid(contactEmail, 320) ||
      (contactEmail != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) ||
      !optionalTextIsValid(preferredCaste, 120) ||
      !optionalTextIsValid(preferredCity, 120) ||
      !optionalTextIsValid(preferredEducation, 160) ||
      !optionalTextIsValid(clientOrigin, 80) ||
      !optionalTextIsValid(preferences, 1000) ||
      !optionalTextIsValid(description, 2000) ||
      !optionalTextIsValid(requirements, 2000) ||
      (preferredMinHeightCm != null && (!Number.isInteger(Number(preferredMinHeightCm)) || Number(preferredMinHeightCm) < 80 || Number(preferredMinHeightCm) > 250)) ||
      (preferredMaxHeightCm != null && (!Number.isInteger(Number(preferredMaxHeightCm)) || Number(preferredMaxHeightCm) < 80 || Number(preferredMaxHeightCm) > 250)) ||
      (preferredMinHeightCm != null && preferredMaxHeightCm != null && Number(preferredMinHeightCm) > Number(preferredMaxHeightCm)) ||
      (preferredMinAge != null && (!Number.isInteger(Number(preferredMinAge)) || Number(preferredMinAge) < 18 || Number(preferredMinAge) > 120)) ||
      (preferredMaxAge != null && (!Number.isInteger(Number(preferredMaxAge)) || Number(preferredMaxAge) < 18 || Number(preferredMaxAge) > 120)) ||
      (preferredMinAge != null && preferredMaxAge != null && Number(preferredMinAge) > Number(preferredMaxAge))
    ) {
      return res.status(400).json({ error: "Profile data is invalid. Check required fields, dates, ages, heights, income, and marital status." });
    }
    if (req.user.subscriptionPlan === "NORMAL" && normalizedClientOrigin !== "PAKISTAN") {
      return res.status(403).json({ error: "The Normal plan can create Pakistan-based profiles only." });
    }

    const profile = await prisma.clientProfile.update({
      where: { id: existing.id },
      data: {
        fullName: fullName.trim(),
        gender: gender.trim(),
        dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
        heightCm: numericHeight,
        propertyMarlas: property,
        education: education.trim(),
        profession: profession?.trim() || null,
        incomeMin: incomeMin == null ? null : Number(incomeMin),
        incomeMax: incomeMax == null ? null : Number(incomeMax),
        maritalStatus,
        maritalHistory,
        caste: caste.trim(),
        city: city.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail?.trim() || null,
        preferredCaste: preferredCaste?.trim() || null,
        preferredMinAge: preferredMinAge == null ? null : Number(preferredMinAge),
        preferredMaxAge: preferredMaxAge == null ? null : Number(preferredMaxAge),
        preferredCity: preferredCity?.trim() || null,
        preferredEducation: preferredEducation?.trim() || null,
        preferredMinHeightCm: preferredMinHeightCm == null ? null : Number(preferredMinHeightCm),
        preferredMaxHeightCm: preferredMaxHeightCm == null ? null : Number(preferredMaxHeightCm),
        clientOrigin: normalizedClientOrigin,
        preferences: preferences?.trim() || null,
        description: description?.trim() || null,
        requirements: requirements?.trim() || null,
        ...(req.file ? { photoData: req.file.buffer, photoMimeType: req.file.mimetype } : {}),
      },
      select: { ...profileFields, contactPhone: true, contactEmail: true },
    });
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/photo", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const profile = await prisma.clientProfile.findUnique({
      where: { id: req.params.id },
      select: {
        matchmakerId: true,
        isVisible: true,
        photoData: true,
        photoMimeType: true,
      },
    });
    if (!profile || !profile.isVisible || !profile.photoData || !profile.photoMimeType) {
      return res.status(404).json({ error: "Profile photo not found." });
    }
    if (req.user.role !== "ADMIN" && profile.matchmakerId !== req.user.id) {
      const isCoordinationParticipant = await prisma.coordinationRequest.findFirst({
        where: {
          targetProfileId: req.params.id,
          OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
        },
        select: { id: true },
      });
      if (!isCoordinationParticipant) {
        return res.status(403).json({ error: "Only the profile owner, an administrator, or a coordination participant can view this photo." });
      }
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

router.delete("/:id", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const where = req.user.role === "ADMIN"
      ? { id: req.params.id }
      : { id: req.params.id, matchmakerId: req.user.id };
    const result = await prisma.clientProfile.deleteMany({ where });
    if (!result.count) return res.status(404).json({ error: "Profile not found." });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", authenticate, requirePlatformAccess, async (req, res, next) => {
  try {
    const profile = await prisma.clientProfile.findUnique({ where: { id: req.params.id } });
    if (!profile || !profile.isVisible) return res.status(404).json({ error: "Profile not found." });

    const ownsProfile = req.user.role === "ADMIN" || profile.matchmakerId === req.user.id;
    let hasApprovedRequest = false;
    if (!ownsProfile) {
      hasApprovedRequest = Boolean(await prisma.coordinationRequest.findFirst({
        where: {
          senderId: req.user.id,
          targetProfileId: profile.id,
          status: "APPROVED",
        },
        select: { id: true },
      }));
    }

    const { contactPhone, contactEmail, ...profileDetails } = profile;
    const publicProfile = Object.fromEntries(
      Object.keys(publicProfileFields).map((key) => [key, profile[key]]),
    );
    return res.json({
      profile: {
        ...(ownsProfile || req.user.role === "ADMIN" ? profileDetails : publicProfile),
        ...(ownsProfile || req.user.role === "ADMIN" || hasApprovedRequest ? { contactPhone, contactEmail } : {}),
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

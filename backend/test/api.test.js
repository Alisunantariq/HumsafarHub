process.env.JWT_SECRET = "api-test-secret-with-at-least-32-characters";
process.env.SUBSCRIPTION_TEST_MODE = "false";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/db");

const senderId = "00000000-0000-4000-8000-000000000001";
const receiverId = "00000000-0000-4000-8000-000000000002";
const profileId = "00000000-0000-4000-8000-000000000003";
const requestId = "00000000-0000-4000-8000-000000000004";
const adminId = "00000000-0000-4000-8000-000000000005";

const users = {
  [senderId]: {
    id: senderId,
    role: "MATCHMAKER",
    approvalStatus: "APPROVED",
    subscriptionStatus: "ACTIVE",
    subscriptionPlan: "GOLDEN",
    isActive: true,
  },
  [receiverId]: {
    id: receiverId,
    role: "MATCHMAKER",
    approvalStatus: "APPROVED",
    subscriptionStatus: "ACTIVE",
    subscriptionPlan: "GOLDEN",
    isActive: true,
  },
};

const profile = {
  id: profileId,
  matchmakerId: receiverId,
  fullName: "Private client",
  gender: "Female",
  dateOfBirth: new Date("1995-01-01T00:00:00.000Z"),
  heightCm: 165,
  propertyMarlas: 10,
  education: "University",
  profession: "Professional",
  incomeMin: null,
  incomeMax: null,
  maritalStatus: "NEVER_MARRIED",
  maritalHistory: null,
  caste: "Example",
  city: "Lahore",
  contactPhone: "+92 300 0000000",
  contactEmail: "private@example.test",
  preferredCaste: null,
  preferredMinHeightCm: null,
  preferredMaxHeightCm: null,
  clientOrigin: "PAKISTAN",
  preferences: null,
  description: null,
  requirements: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  isVisible: true,
};

function tokenFor(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET);
}

async function startServer(t) {
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function mockPrisma(t, delegateName, methodName, implementation) {
  const delegate = prisma[delegateName];
  const original = delegate[methodName];
  delegate[methodName] = implementation;
  t.after(() => {
    delegate[methodName] = original;
  });
}

function authHeaders(userId) {
  return { authorization: `Bearer ${tokenFor(userId)}` };
}

function profileForm(body, photo = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value !== null && value !== undefined) form.append(key, String(value));
  }
  if (photo) {
    form.append("photo", new Blob([photo], { type: "image/png" }), "client.png");
  }
  return form;
}

test("consultant registration validates and stores the required phone number", async (t) => {
  const baseUrl = await startServer(t);
  let createdUser;
  mockPrisma(t, "user", "create", async ({ data }) => {
    createdUser = { id: senderId, ...data, role: "MATCHMAKER", approvalStatus: "PENDING" };
    return createdUser;
  });

  const invalid = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "A Consultant",
      email: "consultant@example.test",
      password: "long-enough-password",
      phoneNumber: "not a phone",
      dateOfBirth: "1990-01-01",
      legalAccepted: true,
    }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(createdUser, undefined);

  const underage = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "A Consultant",
      email: "consultant@example.test",
      password: "long-enough-password",
      phoneNumber: "+92 300 1234567",
      dateOfBirth: new Date().toISOString().slice(0, 10),
      legalAccepted: true,
    }),
  });
  assert.equal(underage.status, 400);
  assert.equal(createdUser, undefined);

  const missingConsent = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "A Consultant",
      email: "consultant@example.test",
      password: "long-enough-password",
      phoneNumber: "+92 300 1234567",
      dateOfBirth: "1990-01-01",
      legalAccepted: false,
    }),
  });
  assert.equal(missingConsent.status, 400);
  assert.equal(createdUser, undefined);

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "A Consultant",
      email: "consultant@example.test",
      password: "long-enough-password",
      phoneNumber: " +92 300 1234567 ",
      dateOfBirth: "1990-01-01",
      legalAccepted: true,
    }),
  });
  assert.equal(response.status, 201);
  assert.equal(createdUser.phoneNumber, "+92 300 1234567");
  assert.equal(createdUser.dateOfBirth.toISOString().slice(0, 10), "1990-01-01");
  assert.ok(createdUser.legalAcceptedAt instanceof Date);
  assert.equal(createdUser.legalVersion, "2026-10-19-v2");
  assert.equal((await response.json()).user.phoneNumber, "+92 300 1234567");
});

test("admin client profiles include the uploading consultant's phone number", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async () => ({
    id: adminId,
    role: "ADMIN",
    isActive: true,
  }));
  mockPrisma(t, "clientProfile", "findMany", async ({ select }) => {
    assert.deepEqual(select.matchmaker, { select: { fullName: true, phoneNumber: true } });
    return [{
      ...profile,
      matchmaker: { fullName: "Consultant Name", phoneNumber: "+92 300 1234567" },
    }];
  });

  const response = await fetch(`${baseUrl}/api/admin/profiles`, {
    headers: authHeaders(adminId),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.profiles[0].matchmaker.fullName, "Consultant Name");
  assert.equal(body.profiles[0].matchmaker.phoneNumber, "+92 300 1234567");
});

test("admin pending payments count each matchmaker with a ready subscription checkout once", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async () => ({
    id: adminId,
    role: "ADMIN",
    isActive: true,
  }));
  mockPrisma(t, "user", "count", async ({ where }) =>
    where.approvalStatus === "PENDING" ? 2 : 5,
  );
  mockPrisma(t, "clientProfile", "count", async () => 8);
  mockPrisma(t, "subscription", "findMany", async (query) => {
    assert.deepEqual(query, {
      where: { status: "PENDING", checkoutStatus: "READY" },
      distinct: ["userId"],
      select: { userId: true },
    });
    return [
      { userId: senderId },
      { userId: receiverId },
    ];
  });

  const response = await fetch(`${baseUrl}/api/admin/summary`, {
    headers: authHeaders(adminId),
  });
  assert.equal(response.status, 200);
  const { summary } = await response.json();
  assert.deepEqual(summary, {
    matchmakers: 5,
    profiles: 8,
    pendingApprovals: 2,
    pendingPayments: 2,
  });
});

test("protected platform endpoints reject unauthenticated and unapproved users", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async () => ({
    ...users[senderId],
    approvalStatus: "PENDING",
  }));

  const unauthenticated = await fetch(`${baseUrl}/api/profiles`);
  assert.equal(unauthenticated.status, 401);

  const pending = await fetch(`${baseUrl}/api/profiles`, {
    headers: authHeaders(senderId),
  });
  assert.equal(pending.status, 403);
  assert.match((await pending.json()).error, /awaiting approval/i);
});

test("profile contacts stay private until the sender's request is approved", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  mockPrisma(t, "clientProfile", "findUnique", async () => profile);
  mockPrisma(t, "coordinationRequest", "findFirst", async () => null);

  const response = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    headers: authHeaders(senderId),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.profile.city, profile.city);
  assert.equal("contactPhone" in body.profile, false);
  assert.equal("contactEmail" in body.profile, false);
  assert.equal("matchmakerId" in body.profile, false);
});

test("client profile creation enforces adult age and the approved marital-history choices", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  let createdProfile;
  mockPrisma(t, "clientProfile", "create", async ({ data }) => {
    createdProfile = { id: profileId, ...data };
    return createdProfile;
  });
  const baseBody = {
    fullName: "Client Profile",
    gender: "Female",
    dateOfBirth: "1995-01-01",
    heightCm: 165,
    propertyMarlas: 10,
    education: "University",
    maritalStatus: "DIVORCED",
    maritalHistory: "Divorced with children",
    caste: "Example",
    city: "Lahore",
    contactPhone: "+92 300 0000000",
  };

  const missingPhoto = await fetch(`${baseUrl}/api/profiles`, {
    method: "POST",
    headers: authHeaders(senderId),
    body: profileForm(baseBody, null),
  });
  assert.equal(missingPhoto.status, 400);
  assert.equal((await missingPhoto.json()).error, "A client photo is required.");
  assert.equal(createdProfile, undefined);

  const underage = await fetch(`${baseUrl}/api/profiles`, {
    method: "POST",
    headers: authHeaders(senderId),
    body: profileForm({ ...baseBody, dateOfBirth: new Date().toISOString().slice(0, 10) }),
  });
  assert.equal(underage.status, 400);
  assert.equal(createdProfile, undefined);

  const invalidHistory = await fetch(`${baseUrl}/api/profiles`, {
    method: "POST",
    headers: authHeaders(senderId),
    body: profileForm({ ...baseBody, maritalHistory: "Separated" }),
  });
  assert.equal(invalidHistory.status, 400);
  assert.equal(createdProfile, undefined);

  const response = await fetch(`${baseUrl}/api/profiles`, {
    method: "POST",
    headers: authHeaders(senderId),
    body: profileForm(baseBody),
  });
  assert.equal(response.status, 201);
  assert.equal(createdProfile.maritalHistory, "Divorced with children");
  assert.equal(createdProfile.maritalStatus, "DIVORCED");
  assert.equal(createdProfile.photoMimeType, "image/png");
  assert.ok(createdProfile.photoData instanceof Buffer);
});

test("client photos are available to the owner, administrator, and coordination participants", async (t) => {
  const baseUrl = await startServer(t);
  let currentUser = users[senderId];
  let coordinationParticipant = false;
  const photoData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  mockPrisma(t, "user", "findUnique", async () => currentUser);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  mockPrisma(t, "clientProfile", "findUnique", async () => ({
    matchmakerId: receiverId,
    isVisible: true,
    photoData,
    photoMimeType: "image/png",
  }));
  mockPrisma(t, "coordinationRequest", "findFirst", async ({ where }) => {
    assert.equal(where.targetProfileId, profileId);
    assert.ok(where.OR.some((condition) => condition.senderId === senderId));
    return coordinationParticipant ? { id: requestId } : null;
  });

  const unauthorized = await fetch(`${baseUrl}/api/profiles/${profileId}/photo`, {
    headers: authHeaders(senderId),
  });
  assert.equal(unauthorized.status, 403);

  coordinationParticipant = true;
  const participantResponse = await fetch(`${baseUrl}/api/profiles/${profileId}/photo`, {
    headers: authHeaders(senderId),
  });
  assert.equal(participantResponse.status, 200);
  assert.deepEqual(Buffer.from(await participantResponse.arrayBuffer()), photoData);

  coordinationParticipant = false;
  currentUser = {
    id: receiverId,
    role: "MATCHMAKER",
    approvalStatus: "APPROVED",
    subscriptionStatus: "ACTIVE",
    subscriptionPlan: "GOLDEN",
    isActive: true,
  };
  const ownerResponse = await fetch(`${baseUrl}/api/profiles/${profileId}/photo`, {
    headers: authHeaders(receiverId),
  });
  assert.equal(ownerResponse.status, 200);
  assert.equal(ownerResponse.headers.get("content-type"), "image/png");
  assert.equal(ownerResponse.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await ownerResponse.arrayBuffer()), photoData);

  currentUser = {
    id: adminId,
    role: "ADMIN",
    approvalStatus: "APPROVED",
    subscriptionStatus: "ACTIVE",
    subscriptionPlan: null,
    isActive: true,
  };
  const adminResponse = await fetch(`${baseUrl}/api/profiles/${profileId}/photo`, {
    headers: authHeaders(adminId),
  });
  assert.equal(adminResponse.status, 200);
});

test("coordination requires receiver approval before contact details are revealed", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  mockPrisma(t, "clientProfile", "findUnique", async () => profile);

  let requestStatus = "PENDING";
  mockPrisma(t, "coordinationRequest", "findFirst", async ({ where }) => {
    if (where.status === "APPROVED") {
      return requestStatus === "APPROVED" ? { id: requestId } : null;
    }
    return null;
  });
  mockPrisma(t, "coordinationRequest", "create", async ({ data }) => ({
    id: requestId,
    ...data,
    status: "PENDING",
  }));
  mockPrisma(t, "coordinationRequest", "findUnique", async () => ({
    id: requestId,
    senderId,
    receiverId,
    targetProfileId: profileId,
    status: requestStatus,
    targetProfile: {
      id: profileId,
      contactPhone: profile.contactPhone,
      contactEmail: profile.contactEmail,
    },
  }));
  mockPrisma(t, "coordinationRequest", "updateMany", async ({ where, data }) => {
    assert.equal(where.receiverId, receiverId);
    requestStatus = data.status;
    return { count: 1 };
  });

  const created = await fetch(`${baseUrl}/api/coordination/request`, {
    method: "POST",
    headers: { ...authHeaders(senderId), "content-type": "application/json" },
    body: JSON.stringify({ targetProfileId: profileId }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).request.status, "PENDING");

  const requesterApproval = await fetch(`${baseUrl}/api/coordination/${requestId}`, {
    method: "PATCH",
    headers: { ...authHeaders(senderId), "content-type": "application/json" },
    body: JSON.stringify({ status: "APPROVED" }),
  });
  assert.equal(requesterApproval.status, 403);
  assert.equal(requestStatus, "PENDING");

  const receiverApproval = await fetch(`${baseUrl}/api/coordination/${requestId}`, {
    method: "PATCH",
    headers: { ...authHeaders(receiverId), "content-type": "application/json" },
    body: JSON.stringify({ status: "APPROVED" }),
  });
  assert.equal(receiverApproval.status, 200);
  assert.equal((await receiverApproval.json()).request.status, "APPROVED");

  const contactResponse = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    headers: authHeaders(senderId),
  });
  assert.equal(contactResponse.status, 200);
  const contactBody = await contactResponse.json();
  assert.equal(contactBody.profile.contactPhone, profile.contactPhone);
  assert.equal(contactBody.profile.contactEmail, profile.contactEmail);
});

test("consultants receive ranked compatibility scores for all eligible candidates", async (t) => {
  const baseUrl = await startServer(t);
  const birthDateForAge = (age) => {
    const now = new Date();
    return new Date(Date.UTC(
      now.getUTCFullYear() - age,
      now.getUTCMonth(),
      now.getUTCDate(),
    ));
  };
  const source = {
    ...profile,
    id: profileId,
    matchmakerId: senderId,
    gender: "Male",
    dateOfBirth: birthDateForAge(35),
    preferredMinAge: 30,
    preferredMaxAge: 40,
    preferredCity: "Lahore",
  };
  const candidate = {
    ...profile,
    id: "00000000-0000-4000-8000-000000000006",
    matchmakerId: receiverId,
    fullName: "External client",
    matchmaker: { fullName: "Receiving Consultant", phoneNumber: "+92 300 7654321" },
    gender: "Female",
    dateOfBirth: birthDateForAge(35),
    preferredMinAge: 30,
    preferredMaxAge: 40,
  };
  const boundaryCandidate = {
    ...candidate,
    id: "00000000-0000-4000-8000-000000000009",
    fullName: "Boundary candidate",
    dateOfBirth: birthDateForAge(30),
  };
  const sameConsultantCandidate = {
    ...candidate,
    id: "00000000-0000-4000-8000-000000000007",
    matchmakerId: senderId,
    fullName: "My other client",
  };
  const incompatibleCandidate = {
    ...candidate,
    id: "00000000-0000-4000-8000-000000000010",
    fullName: "City mismatch",
    city: "Karachi",
  };
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  mockPrisma(t, "clientProfile", "findUnique", async ({ where }) => ({
    ...source,
    id: where.id,
    matchmakerId: where.id === profileId ? senderId : receiverId,
  }));
  let candidateQuery;
  mockPrisma(t, "clientProfile", "findMany", async (query) => {
    candidateQuery = query;
    return [boundaryCandidate, candidate, sameConsultantCandidate, incompatibleCandidate];
  });

  const response = await fetch(`${baseUrl}/api/matching/${profileId}`, {
    headers: authHeaders(senderId),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(candidateQuery.where.id, { not: profileId });
  assert.deepEqual(candidateQuery.where.matchmaker, {
    is: { subscriptionPlan: "NORMAL" },
  });
  assert.equal("take" in candidateQuery, false);
  assert.equal(body.matches.length, 4);
  assert.equal(body.matches[0].id, candidate.id);
  assert.equal(body.matches[0].compatibilityPercent, 100);
  assert.equal(body.matches[1].id, sameConsultantCandidate.id);
  assert.equal(body.matches[1].compatibilityPercent, 100);
  assert.equal(body.matches[2].id, boundaryCandidate.id);
  assert.equal(body.matches[2].compatibilityPercent, 96);
  assert.equal(body.matches[2].isCompatible, true);
  assert.equal(body.matches[3].id, incompatibleCandidate.id);
  assert.ok(body.matches[3].compatibilityPercent < 85);
  assert.equal(body.matches[3].isCompatible, false);
  assert.deepEqual(body.matches[3].failedCriteria, ["Preferred city"]);
  assert.equal("matchmakerId" in body.matches[0], false);
  assert.equal("contactPhone" in body.matches[0], false);
  assert.equal("contactEmail" in body.matches[0], false);
  assert.equal("photoData" in body.matches[0], false);
  assert.equal(body.matches[0].matchmaker.fullName, "Receiving Consultant");
  assert.equal(body.matches[0].matchmaker.phoneNumber, "+92 300 7654321");
  assert.equal(body.matches[0].incomeMin, profile.incomeMin);
  assert.equal(body.matches[0].maritalHistory, profile.maritalHistory);
  assert.equal(body.matches[0].requirements, profile.requirements);
  assert.equal("contactPhone" in candidateQuery.select, false);
  assert.equal("contactEmail" in candidateQuery.select, false);
  assert.equal("photoData" in candidateQuery.select, false);
  assert.equal(candidateQuery.select.matchmaker.select.phoneNumber, true);

  const notOwned = await fetch(`${baseUrl}/api/matching/00000000-0000-4000-8000-000000000008`, {
    headers: authHeaders(senderId),
  });
  assert.equal(notOwned.status, 403);
});

test("consultants can load photos only for candidates in their owned profile's match pool", async (t) => {
  const baseUrl = await startServer(t);
  const source = {
    ...profile,
    id: profileId,
    matchmakerId: senderId,
    gender: "Male",
  };
  const candidatePhoto = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  mockPrisma(t, "clientProfile", "findUnique", async () => source);
  let candidateGender = "Female";
  let candidateQuery;
  mockPrisma(t, "clientProfile", "findFirst", async (query) => {
    candidateQuery = query;
    return {
      id: "00000000-0000-4000-8000-000000000006",
      gender: candidateGender,
      dateOfBirth: new Date("1995-01-01T00:00:00.000Z"),
      heightCm: 165,
      propertyMarlas: 10,
      education: "University",
      caste: "Example",
      city: "Lahore",
      photoData: candidatePhoto,
      photoMimeType: "image/png",
    };
  });

  const response = await fetch(`${baseUrl}/api/matching/${profileId}/00000000-0000-4000-8000-000000000006/photo`, {
    headers: authHeaders(senderId),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(candidateQuery.where.matchmaker, { is: { subscriptionPlan: "NORMAL" } });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), candidatePhoto);

  candidateGender = "Male";
  const notInMatchResults = await fetch(`${baseUrl}/api/matching/${profileId}/00000000-0000-4000-8000-000000000006/photo`, {
    headers: authHeaders(senderId),
  });
  assert.equal(notInMatchResults.status, 404);

  const notOwner = await fetch(`${baseUrl}/api/matching/00000000-0000-4000-8000-000000000008/00000000-0000-4000-8000-000000000006/photo`, {
    headers: authHeaders(receiverId),
  });
  assert.equal(notOwner.status, 403);
});

test("consultants can update their profiles while preserving or replacing the photo", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "findFirst", async () => ({
    status: "ACTIVE",
    currentPeriodEnd: null,
  }));
  const existing = {
    ...profile,
    matchmakerId: senderId,
    maritalHistory: "Single",
    preferredMinAge: 30,
    preferredMaxAge: 40,
    photoData: Buffer.from("existing-photo"),
    photoMimeType: "image/png",
  };
  let updateData;
  mockPrisma(t, "clientProfile", "findFirst", async ({ where }) =>
    where.matchmakerId === senderId ? existing : null,
  );
  mockPrisma(t, "clientProfile", "update", async ({ data }) => {
    updateData = data;
    return { ...existing, ...data };
  });
  const body = {
    fullName: existing.fullName,
    gender: existing.gender,
    dateOfBirth: "1995-01-01",
    heightCm: existing.heightCm,
    propertyMarlas: existing.propertyMarlas,
    education: existing.education,
    maritalStatus: existing.maritalStatus,
    maritalHistory: "Single",
    caste: existing.caste,
    city: existing.city,
    contactPhone: existing.contactPhone,
    preferredMinAge: 30,
    preferredMaxAge: 40,
    preferredCity: "",
  };

  const preserveResponse = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: authHeaders(senderId),
    body: profileForm(body, null),
  });
  assert.equal(preserveResponse.status, 200);
  assert.equal(updateData.photoData, undefined);
  assert.equal(updateData.preferredCity, null);

  const replacement = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const replaceResponse = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: authHeaders(senderId),
    body: profileForm(body, replacement),
  });
  assert.equal(replaceResponse.status, 200);
  assert.deepEqual(updateData.photoData, replacement);
  assert.equal(updateData.photoMimeType, "image/png");

  const maximumSizePhoto = Buffer.alloc(3 * 1024 * 1024);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(maximumSizePhoto);
  const maximumSizeResponse = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: authHeaders(senderId),
    body: profileForm(body, maximumSizePhoto),
  });
  assert.equal(maximumSizeResponse.status, 200);

  const tooLarge = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: authHeaders(senderId),
    body: profileForm(body, Buffer.alloc(3 * 1024 * 1024 + 1)),
  });
  assert.equal(tooLarge.status, 413);

  const partialForm = new FormData();
  partialForm.append("fullName", "Updated Client");
  const partialResponse = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: authHeaders(senderId),
    body: partialForm,
  });
  assert.equal(partialResponse.status, 200);
  assert.equal(updateData.fullName, "Updated Client");
  assert.equal(updateData.dateOfBirth.toISOString().slice(0, 10), "1995-01-01");

  const notOwner = await fetch(`${baseUrl}/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: authHeaders(receiverId),
    body: profileForm(body, null),
  });
  assert.equal(notOwner.status, 404);
});

test("subscription checkout derives the selected plan and amount on the server", async (t) => {
  const baseUrl = await startServer(t);
  mockPrisma(t, "user", "findUnique", async ({ where }) => users[where.id]);
  mockPrisma(t, "subscription", "update", async () => ({}));

  const environment = {
    SAFEPAY_ENV: "sandbox",
    SAFEPAY_HOST: "https://sandbox.api.getsafepay.com",
    SAFEPAY_CHECKOUT_HOST: "https://sandbox.api.getsafepay.com",
    SAFEPAY_SECRET_KEY: "api-test-merchant-secret",
    SAFEPAY_WEBHOOK_SECRET: "api-test-webhook-secret",
    SAFEPAY_NORMAL_MONTHLY_PLAN_ID: "plan_api-normal",
    SAFEPAY_GOLDEN_PLAN_ID: "plan_api-golden",
    APP_URL: "http://localhost:5173",
    SAFEPAY_WEBHOOK_URL: "https://hamsafar-test.ngrok-free.app/api/subscriptions/safepay/webhook",
    SUBSCRIPTION_GRACE_DAYS: "3",
  };
  const previousEnvironment = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: "api-test-checkout-token" }),
  });
  t.after(() => { global.fetch = originalFetch; });

  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) => callback({
    $queryRaw: async () => [],
    subscription: {
      findFirst: async () => null,
      create: async ({ data }) => ({
        id: "sub_test",
        ...data,
      }),
    },
  });
  t.after(() => { prisma.$transaction = originalTransaction; });

  const plansResponse = await originalFetch(`${baseUrl}/api/subscriptions/plans`);
  const plans = await plansResponse.json();
  assert.equal(plans.testMode, false);
  assert.equal(plans.plans.find((plan) => plan.tier === "normal").amount, 10000);
  assert.equal(plans.plans.find((plan) => plan.tier === "normal").interval, "MONTH");

  const normalResponse = await originalFetch(`${baseUrl}/api/subscriptions/checkout/normal`, {
    method: "POST",
    headers: authHeaders(senderId),
  });
  assert.equal(normalResponse.status, 201);
  const normalBody = await normalResponse.json();
  assert.equal(normalBody.amountPkr, 10000);
  assert.equal(normalBody.interval, "MONTH");
  assert.equal(new URL(normalBody.checkoutUrl).searchParams.get("plan_id"), "plan_api-normal");

  const response = await originalFetch(`${baseUrl}/api/subscriptions/checkout/golden`, {
    method: "POST",
    headers: authHeaders(senderId),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.amountPkr, 15000);
  assert.equal(body.tier, "GOLDEN");
  const checkoutUrl = new URL(body.checkoutUrl);
  assert.equal(checkoutUrl.searchParams.get("plan_id"), "plan_api-golden");
  assert.equal(checkoutUrl.searchParams.get("auth_token"), "api-test-checkout-token");
  assert.match(checkoutUrl.searchParams.get("reference"), /^subref_/);
});

test("development test mode disables Safepay and grants free access without bypassing approval", async (t) => {
  const baseUrl = await startServer(t);
  const previousMode = process.env.SUBSCRIPTION_TEST_MODE;
  process.env.NODE_ENV = "development";
  process.env.SUBSCRIPTION_TEST_MODE = "true";
  t.after(() => {
    if (previousMode === undefined) delete process.env.SUBSCRIPTION_TEST_MODE;
    else process.env.SUBSCRIPTION_TEST_MODE = previousMode;
  });
  let updatedUser;
  mockPrisma(t, "user", "findUnique", async ({ where }) => ({
    ...users[where.id],
    subscriptionPlan: "NORMAL",
  }));
  mockPrisma(t, "user", "update", async ({ data }) => {
    updatedUser = data;
    return { ...users[senderId], ...data };
  });
  mockPrisma(t, "subscription", "findFirst", async () => null);
  mockPrisma(t, "clientProfile", "findMany", async () => []);

  const plansResponse = await fetch(`${baseUrl}/api/subscriptions/plans`);
  const plans = await plansResponse.json();
  assert.equal(plans.testMode, true);
  assert.equal(plans.provider, null);

  const checkoutResponse = await fetch(`${baseUrl}/api/subscriptions/checkout/normal`, {
    method: "POST",
    headers: authHeaders(senderId),
  });
  assert.equal(checkoutResponse.status, 503);

  const testAccessResponse = await fetch(`${baseUrl}/api/subscriptions/test-access/golden`, {
    method: "POST",
    headers: authHeaders(senderId),
  });
  assert.equal(testAccessResponse.status, 200);
  assert.equal(updatedUser.subscriptionPlan, "GOLDEN");

  const profilesResponse = await fetch(`${baseUrl}/api/profiles`, {
    headers: authHeaders(senderId),
  });
  assert.equal(profilesResponse.status, 200);

  mockPrisma(t, "user", "findUnique", async ({ where }) => ({
    ...users[where.id],
    approvalStatus: "PENDING",
  }));
  const pendingResponse = await fetch(`${baseUrl}/api/profiles`, {
    headers: authHeaders(senderId),
  });
  assert.equal(pendingResponse.status, 403);

  const webhookResponse = await fetch(`${baseUrl}/api/subscriptions/safepay/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(webhookResponse.status, 503);
});

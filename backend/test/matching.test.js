const test = require("node:test");
const assert = require("node:assert/strict");
const { matchesRules, compatibilityPercent, evaluateMatch } = require("../src/services/matching");

function profile(overrides = {}) {
  const isCandidate = overrides.id === "profile-b";
  return {
    id: "profile-a",
    gender: isCandidate ? "Male" : "Female",
    dateOfBirth: new Date(isCandidate ? "1992-01-01T00:00:00.000Z" : "1990-01-01T00:00:00.000Z"),
    caste: "Example",
    city: "Lahore",
    education: "University",
    profession: "Professional",
    maritalStatus: "NEVER_MARRIED",
    preferredCaste: null,
    heightCm: 170,
    preferredMinAge: 30,
    preferredMaxAge: 40,
    preferredCity: null,
    preferredEducation: null,
    preferredMinHeightCm: null,
    preferredMaxHeightCm: null,
    propertyMarlas: 10,
    ...overrides,
  };
}

test("property threshold allows an 8 marla candidate for a 10 marla profile", () => {
  assert.equal(matchesRules(profile(), profile({ id: "profile-b", propertyMarlas: 8 })), true);
});

test("property threshold rejects candidates below 8 marlas when either profile has at least 10", () => {
  assert.equal(matchesRules(profile(), profile({ id: "profile-b", propertyMarlas: 7.99 })), false);
  assert.equal(matchesRules(profile({ propertyMarlas: 8 }), profile({ id: "profile-b", propertyMarlas: 10 })), true);
  assert.equal(matchesRules(profile({ propertyMarlas: 7.99 }), profile({ id: "profile-b", propertyMarlas: 10 })), false);
  const evaluation = evaluateMatch(
    profile(),
    profile({ id: "profile-b", propertyMarlas: 7.99 }),
    new Date("2026-10-19T00:00:00.000Z"),
  );
  assert.ok(evaluation.compatibilityPercent < 85);
  assert.equal(evaluation.isCompatible, false);
  assert.deepEqual(evaluation.failedCriteria, ["Property threshold (8/10 Marlas)"]);
});

test("caste preferences are reciprocal and case-insensitive", () => {
  assert.equal(matchesRules(profile({ preferredCaste: "EXAMPLE" }), profile({ id: "profile-b" })), true);
  assert.equal(matchesRules(profile({ preferredCaste: "Other" }), profile({ id: "profile-b" })), false);
  assert.equal(matchesRules(profile(), profile({ id: "profile-b", preferredCaste: "Other" })), false);
});

test("height preferences must be satisfied in both directions", () => {
  assert.equal(matchesRules(profile({ preferredMinHeightCm: 175 }), profile({ id: "profile-b", heightCm: 175 })), true);
  assert.equal(matchesRules(profile({ preferredMaxHeightCm: 169 }), profile({ id: "profile-b" })), false);
  assert.equal(matchesRules(profile(), profile({ id: "profile-b", preferredMinHeightCm: 180 })), false);
});

test("matches only profiles of the opposite gender", () => {
  assert.equal(matchesRules(profile(), profile({ id: "profile-b", gender: "Female" })), false);
  assert.equal(matchesRules(profile(), profile({ id: "profile-b", gender: "Other" })), false);
});

test("reciprocal structured age, city, and education requirements are enforced", () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  const source = profile({
    preferredMinAge: 30,
    preferredMaxAge: 40,
    preferredCity: "Lahore",
    preferredEducation: "university",
  });
  const eligible = profile({ id: "profile-b" });
  assert.equal(matchesRules(source, eligible, now), true);
  assert.equal(matchesRules(source, profile({ id: "profile-b", city: "Karachi" }), now), false);
  assert.equal(matchesRules(source, profile({ id: "profile-b", education: "College" }), now), false);
  assert.equal(matchesRules(source, profile({
    id: "profile-b",
    dateOfBirth: new Date("2005-01-01T00:00:00.000Z"),
  }), now), false);
  assert.equal(matchesRules(profile({
    preferredMaxAge: 30,
  }), eligible, now), false);
});

test("scores only stated preferences and ranks closer preference matches higher", () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  const source = profile();
  const closeMatch = profile({ id: "profile-b" });
  const lowMatch = profile({
    id: "profile-b",
    dateOfBirth: new Date("1975-01-01T00:00:00.000Z"),
    city: "Karachi",
    caste: "Different",
    education: "College",
    maritalStatus: "DIVORCED",
  });
  const closeScore = compatibilityPercent(source, closeMatch, now);
  const boundaryMatch = profile({
    id: "profile-b",
    dateOfBirth: new Date("1996-01-01T00:00:00.000Z"),
  });
  const boundaryScore = compatibilityPercent(source, boundaryMatch, now);
  assert.ok(closeScore > boundaryScore);
  assert.ok(boundaryScore >= 85);
  assert.ok(compatibilityPercent(source, lowMatch, now) < 85);
  assert.equal(matchesRules(source, lowMatch, now), false);
});

test("does not produce a match when neither profile states structured preferences", () => {
  const noPreferences = {
    preferredMinAge: null,
    preferredMaxAge: null,
    preferredCity: null,
    preferredEducation: null,
    preferredCaste: null,
    preferredMinHeightCm: null,
    preferredMaxHeightCm: null,
  };
  assert.equal(compatibilityPercent(profile(noPreferences), profile({
    id: "profile-b",
    ...noPreferences,
  })), 0);
});

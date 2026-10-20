function normalized(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function ageInYears(dateOfBirth, now = new Date()) {
  const birthDate = new Date(dateOfBirth);
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDifference = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function boundedPreferenceScore(value, minimum, maximum, oneSidedScale) {
  if (minimum != null && maximum != null) {
    const midpoint = (minimum + maximum) / 2;
    const radius = (maximum - minimum) / 2;
    if (radius === 0) return value === midpoint ? 100 : 0;
    return Math.max(0, Math.round(100 - 15 * Math.abs(value - midpoint) / radius));
  }
  if (minimum != null) {
    return Math.max(0, Math.round(85 + 15 * (value - minimum) / oneSidedScale));
  }
  return Math.max(0, Math.round(85 + 15 * (maximum - value) / oneSidedScale));
}

function preferenceScores(profile, candidate, candidateAge) {
  const scores = [];
  if (profile.preferredMinAge != null || profile.preferredMaxAge != null) {
    const meetsRange = (profile.preferredMinAge == null || candidateAge >= profile.preferredMinAge) &&
      (profile.preferredMaxAge == null || candidateAge <= profile.preferredMaxAge);
    scores.push({
      criterion: "Age range",
      score: boundedPreferenceScore(candidateAge, profile.preferredMinAge, profile.preferredMaxAge, 20),
      meets: meetsRange,
    });
  }
  const preferredCity = normalized(profile.preferredCity);
  if (preferredCity) {
    const meets = preferredCity === normalized(candidate.city);
    scores.push({ criterion: "Preferred city", score: meets ? 100 : 0, meets });
  }
  const preferredEducation = normalized(profile.preferredEducation);
  if (preferredEducation) {
    const meets = normalized(candidate.education).includes(preferredEducation);
    scores.push({ criterion: "Preferred education", score: meets ? 100 : 0, meets });
  }
  const preferredCaste = normalized(profile.preferredCaste);
  if (preferredCaste) {
    const meets = preferredCaste === normalized(candidate.caste);
    scores.push({ criterion: "Preferred caste", score: meets ? 100 : 0, meets });
  }
  if (profile.preferredMinHeightCm != null || profile.preferredMaxHeightCm != null) {
    const meets = (profile.preferredMinHeightCm == null || candidate.heightCm >= profile.preferredMinHeightCm) &&
      (profile.preferredMaxHeightCm == null || candidate.heightCm <= profile.preferredMaxHeightCm);
    scores.push({
      criterion: "Height range",
      score: boundedPreferenceScore(
        candidate.heightCm,
        profile.preferredMinHeightCm,
        profile.preferredMaxHeightCm,
        30,
      ),
      meets,
    });
  }
  return scores;
}

function evaluateMatch(source, candidate, now = new Date()) {
  if (source.id === candidate.id) return null;

  const sourceGender = normalized(source.gender);
  const candidateGender = normalized(candidate.gender);
  if (!((sourceGender === "male" && candidateGender === "female") ||
    (sourceGender === "female" && candidateGender === "male"))) return null;

  const sourceAge = ageInYears(source.dateOfBirth, now);
  const candidateAge = ageInYears(candidate.dateOfBirth, now);
  const criteria = [
    ...preferenceScores(source, candidate, candidateAge),
    ...preferenceScores(candidate, source, sourceAge),
  ];
  const sourceProperty = Number(source.propertyMarlas);
  const candidateProperty = Number(candidate.propertyMarlas);
  const meetsPropertyRule = !((sourceProperty >= 10 && candidateProperty < 8) ||
    (candidateProperty >= 10 && sourceProperty < 8));
  const failedCriteria = [...new Set(criteria.filter((criterion) => !criterion.meets)
    .map((criterion) => criterion.criterion))];
  if (!meetsPropertyRule) failedCriteria.push("Property threshold (8/10 Marlas)");

  if (criteria.length === 0) {
    return {
      compatibilityPercent: 0,
      isCompatible: false,
      failedCriteria: ["No structured preferences set"],
    };
  }

  criteria.push({
    criterion: "Property threshold (8/10 Marlas)",
    score: meetsPropertyRule ? 100 : 0,
    meets: meetsPropertyRule,
  });
  const average = Math.round(criteria.reduce((sum, criterion) => sum + criterion.score, 0) / criteria.length);
  const compatibilityPercent = failedCriteria.length ? Math.min(average, 84) : average;
  return {
    compatibilityPercent,
    isCompatible: failedCriteria.length === 0 && compatibilityPercent >= 85,
    failedCriteria,
  };
}

function compatibilityPercent(source, candidate, now = new Date()) {
  return evaluateMatch(source, candidate, now)?.compatibilityPercent ?? null;
}

function matchesRules(source, candidate, now = new Date()) {
  return evaluateMatch(source, candidate, now)?.isCompatible ?? false;
}

module.exports = { matchesRules, compatibilityPercent, evaluateMatch };

ALTER TABLE "ClientProfile"
ADD COLUMN "preferredMinAge" INTEGER,
ADD COLUMN "preferredMaxAge" INTEGER,
ADD COLUMN "preferredCity" VARCHAR(120),
ADD COLUMN "preferredEducation" VARCHAR(160);

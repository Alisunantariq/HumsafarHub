CREATE TYPE "Role" AS ENUM ('ADMIN', 'MATCHMAKER');
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "MaritalStatus" AS ENUM ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED');
CREATE TYPE "CoordinationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MATCHMAKER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientProfile" (
    "id" UUID NOT NULL,
    "matchmakerId" UUID NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "gender" VARCHAR(40) NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "propertyMarlas" DECIMAL(7,2) NOT NULL,
    "education" VARCHAR(160) NOT NULL,
    "profession" VARCHAR(160),
    "incomeMin" DECIMAL(14,2),
    "incomeMax" DECIMAL(14,2),
    "maritalStatus" "MaritalStatus" NOT NULL,
    "maritalHistory" VARCHAR(1000),
    "caste" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "contactPhone" VARCHAR(40) NOT NULL,
    "contactEmail" VARCHAR(320),
    "preferredCaste" VARCHAR(120),
    "preferredMinHeightCm" INTEGER,
    "preferredMaxHeightCm" INTEGER,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoordinationRequest" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "targetProfileId" UUID NOT NULL,
    "status" "CoordinationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CoordinationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "body" VARCHAR(10000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_approvalStatus_subscriptionStatus_idx" ON "User"("role", "approvalStatus", "subscriptionStatus");
CREATE INDEX "ClientProfile_matchmakerId_idx" ON "ClientProfile"("matchmakerId");
CREATE INDEX "ClientProfile_caste_city_education_idx" ON "ClientProfile"("caste", "city", "education");
CREATE INDEX "ClientProfile_dateOfBirth_idx" ON "ClientProfile"("dateOfBirth");
CREATE INDEX "ClientProfile_propertyMarlas_idx" ON "ClientProfile"("propertyMarlas");
CREATE INDEX "ClientProfile_isVisible_idx" ON "ClientProfile"("isVisible");
CREATE INDEX "CoordinationRequest_senderId_status_idx" ON "CoordinationRequest"("senderId", "status");
CREATE INDEX "CoordinationRequest_receiverId_status_idx" ON "CoordinationRequest"("receiverId", "status");
CREATE INDEX "CoordinationRequest_targetProfileId_status_idx" ON "CoordinationRequest"("targetProfileId", "status");
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");
CREATE INDEX "Message_senderId_recipientId_idx" ON "Message"("senderId", "recipientId");

ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_matchmakerId_fkey"
    FOREIGN KEY ("matchmakerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoordinationRequest" ADD CONSTRAINT "CoordinationRequest_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoordinationRequest" ADD CONSTRAINT "CoordinationRequest_receiverId_fkey"
    FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoordinationRequest" ADD CONSTRAINT "CoordinationRequest_targetProfileId_fkey"
    FOREIGN KEY ("targetProfileId") REFERENCES "ClientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

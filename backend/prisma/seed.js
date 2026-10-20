require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient, Role, ApprovalStatus, SubscriptionStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD (12-72 UTF-8 bytes) are required to seed the admin.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: "HamsafarHub Administrator",
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  });
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

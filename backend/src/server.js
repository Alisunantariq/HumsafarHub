require("dotenv").config();

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

const app = require("./app");
const prisma = require("./db");
const { startWebhookWorker } = require("./services/subscription-webhooks");

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`HamsafarHub API listening on port ${port}.`);
  startWebhookWorker();
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown failed:", error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

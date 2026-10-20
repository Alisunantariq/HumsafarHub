require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profiles");
const coordinationRoutes = require("./routes/coordination");
const matchingRoutes = require("./routes/matching");
const paymentsRoutes = require("./routes/payments");
const { router: subscriptionsRoutes, handleSafepayWebhook } = require("./routes/subscriptions");
const adminRoutes = require("./routes/admin");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.post(
  "/api/subscriptions/safepay/webhook",
  express.raw({ type: "application/json", limit: "64kb" }),
  handleSafepayWebhook,
);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "8kb" }));

app.get("/", (req, res) => res.json({
  service: "HamsafarHub API",
  status: "ok",
  message: "The backend API is running. Use the API endpoints below.",
  endpoints: {
    health: "GET /health",
    register: "POST /api/auth/register",
    login: "POST /api/auth/login",
    currentUser: "GET /api/auth/me",
    profiles: "GET, POST /api/profiles",
    coordinationRequest: "POST /api/coordination/request",
    coordinationResponse: "PATCH /api/coordination/:id",
    coordination: "GET /api/coordination",
    matching: "GET /api/matching/:profileId",
    matchingPhoto: "GET /api/matching/:sourceProfileId/:candidateProfileId/photo",
    subscriptions: "GET /api/subscriptions/plans, POST /api/subscriptions/checkout/:tier",
    subscriptionWebhook: "POST /api/subscriptions/safepay/webhook",
    admin: "GET /api/admin/summary",
  },
}));
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/coordination", coordinationRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

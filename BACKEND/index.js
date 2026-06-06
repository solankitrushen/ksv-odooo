import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import { connectToMongo, disconnectDB } from "./db.js";
import instaCafeRoutes from "./src/Routes/index.js";
import webhookRouter from "./src/Routes/webhook.js";
import legacyRouter from "./legacyRouter.js";
import { errorHandler } from "./src/Middleware/errorHandler.js";
import { requestLogger } from "./src/Middleware/requestLogger.js";
import { assertJwtConfig } from "./config/jwt.js";
import { loadEnv, isLegacyEnabled } from "./config/env.js";

// Validate environment before booting anything else.
const ENV = loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

connectToMongo();

const viewsPath = path.join(__dirname, "mailService/views");
app.set("views", viewsPath);
app.set("view engine", "ejs");
app.use(cookieParser());

const port = ENV.PORT || process.env.PORT || 4469;
const isProd = ENV.NODE_ENV === "production";
const isTest = ENV.NODE_ENV === "test";

// Behind a reverse proxy/load balancer in prod: trust X-Forwarded-* so req.ip
// (rate-limit keys) and req.secure are correct.
if (isProd) app.set("trust proxy", 1);

// gzip responses, but never buffer Server-Sent Events (would break streaming).
app.use(
  compression({
    filter: (req, res) => {
      const type = res.getHeader("Content-Type");
      if (type && String(type).includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "connect-src": ["'self'"],
          },
        }
      : false,
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// Webhook routes MUST be mounted before express.json so they read raw body.
app.use("/api/v1/webhook", webhookRouter);

app.use(express.json({ limit: ENV.BODY_LIMIT || "100kb" }));
app.use(requestLogger);

const corsOrigins = [
  process.env.CLIENT_URL_1,
  process.env.CLIENT_URL_2,
  process.env.CLIENT_URL_3,
  process.env.CLIENT_URL_4,
  process.env.CLIENT_URL_DEV,
  process.env.CLIENT_URL_PROD,
]
  .flatMap((v) => (v ? v.split(",") : []))
  .map((v) => v.trim())
  .filter(Boolean);

if (isProd && corsOrigins.length === 0) {
  throw new Error(
    "[env] At least one CLIENT_URL_* must be set in production for CORS."
  );
}

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/health", (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res
    .status(dbUp ? 200 : 503)
    .json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
});

// App-wide rate limit (defense-in-depth on top of the stricter auth/login
// limiters). Skipped in tests and for the long-lived SSE stream.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX, 10) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTest || req.path.endsWith("/orders/stream"),
});
app.use("/api/v1", globalLimiter);

// InstaCafe Phase 1+ — modular auth (Admin / Store / User)
try {
  assertJwtConfig();
  const instaCafeRouter = express.Router();
  instaCafeRouter.use(instaCafeRoutes);
  instaCafeRouter.use(errorHandler);
  app.use("/api/v1", instaCafeRouter);
  console.log("✓ InstaCafe mounted at /api/v1");
} catch (err) {
  console.warn("InstaCafe auth not mounted:", err.message);
}

// Legacy IMS (branch managers / employees / shop keepers) — quarantined
// under its own prefix with its own secret. Disable by setting
// LEGACY_IMS_ENABLED=false.
if (isLegacyEnabled()) {
  app.use("/legacy/ims", legacyRouter);
  console.log("✓ Legacy IMS mounted at /legacy/ims");
} else {
  console.log("⚠ Legacy IMS disabled (LEGACY_IMS_ENABLED=false)");
}

app.get("/", (_req, res) => {
  res.json({ message: "Welcome to the InstaCafe API server" });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

const server = app.listen(port, () => {
  console.log(`InstaCafe app listening on http://localhost:${port}`);
});

// Graceful shutdown for zero-downtime deploys: stop accepting connections,
// close the DB, then exit. Force-exit after 10s if something hangs (e.g. an
// open SSE stream).
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    try {
      await disconnectDB();
    } catch (err) {
      console.warn("DB disconnect error:", err.message);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));

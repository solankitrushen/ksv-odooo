import express from "express";
import cookieParser from "cookie-parser";
import instaCafeRoutes from "../../src/Routes/index.js";
import { errorHandler } from "../../src/Middleware/errorHandler.js";
import { connectDB } from "../../src/db.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";

let ready = false;

export async function getTestApp() {
  if (!ready) {
    await connectDB();
    await ensureDefaultAdmin();
    ready = true;
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const router = express.Router();
  router.use(instaCafeRoutes);
  router.use(errorHandler);
  app.use("/api/v1", router);
  return app;
}

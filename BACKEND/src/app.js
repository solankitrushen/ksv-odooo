import { Router } from "express";
import instaCafeRoutes from "./Routes/index.js";
import { assertJwtConfig } from "../config/jwt.js";
import { ensureDefaultAdmin } from "./Auth/seedAdmin.js";
import { logger } from "./Utils/logger.js";

let adminSeeded = false;

export function createInstaCafeRouter() {
  assertJwtConfig();
  const api = Router();
  api.use("/v1", instaCafeRoutes);
  return api;
}

export async function bootstrapInstaCafeAuth() {
  if (!adminSeeded) {
    await ensureDefaultAdmin();
    adminSeeded = true;
    logger.info("InstaCafe auth module ready");
  }
}

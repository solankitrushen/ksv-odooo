import Admin from "../Schema/Admin.js";
import { logger } from "../Utils/logger.js";

export async function ensureDefaultAdmin() {
  // Legacy IMS admin seeding is OFF by default. VendorBridge uses the VbUser /
  // Tenant / VbMembership model (see scripts/seed-vendorbridge.mjs). Opt back in
  // only by explicitly setting SEED_LEGACY_ADMIN=true.
  if (String(process.env.SEED_LEGACY_ADMIN).toLowerCase() !== "true") {
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    logger.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set — skip admin seed");
    return;
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) return;

  await Admin.create({
    email: email.toLowerCase(),
    password,
    name: "InstaCafe Admin",
    permissions: ["view-all-orders", "suspend-store", "view-analytics"],
  });
  logger.info("Default admin account created", { email });
}

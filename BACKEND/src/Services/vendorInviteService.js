import crypto from "crypto";
import { INVITE_STATUS } from "../../config/constants.js";
import { randomToken } from "../Utils/crypto.js";
import VendorInvite from "../Schema/VendorInvite.js";

const INVITE_EXPIRY_MS =
  Number(process.env.INVITE_TOKEN_EXPIRY_MS) || 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

export async function createVendorInvite({ tenantId, vendorId, email, invitedBy }) {
  const rawToken = randomToken(32);
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
  await VendorInvite.findOneAndUpdate(
    { tenantId, vendorId, status: INVITE_STATUS.PENDING },
    {
      tenantId,
      vendorId,
      email,
      tokenHash,
      expiresAt,
      status: INVITE_STATUS.PENDING,
      invitedBy,
      acceptedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { rawToken, expiresAt };
}

export async function consumeVendorInvite(rawToken) {
  const tokenHash = hashInviteToken(rawToken);
  const invite = await VendorInvite.findOne({ tokenHash }).select("+tokenHash");
  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.status !== INVITE_STATUS.PENDING) return { ok: false, reason: "used" };
  if (invite.expiresAt.getTime() < Date.now()) {
    invite.status = INVITE_STATUS.EXPIRED;
    await invite.save();
    return { ok: false, reason: "expired" };
  }
  return { ok: true, invite };
}

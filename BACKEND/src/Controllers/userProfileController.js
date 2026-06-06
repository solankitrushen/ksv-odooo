import { z } from "zod";
import User from "../Schema/User.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,100}$/;
const PHONE_RE = /^[0-9]{10}$/;

export const updateProfileSchema = z
  .object({
    name: z.string().regex(NAME_RE, "Invalid name").optional(),
    phone: z.string().regex(PHONE_RE, "Invalid phone").optional(),
    address: z
      .object({
        street: z.string().max(200).optional(),
        city: z.string().max(100).optional(),
        zipCode: z.string().max(20).optional(),
      })
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

export async function getProfile(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return sendError(res, 404, "Not found", "User not found");
  return sendSuccess(res, 200, { user });
}

export async function updateProfile(req, res) {
  const { name, phone, address } = req.validated;

  if (phone) {
    const existing = await User.findOne({ phone, _id: { $ne: req.userId } });
    if (existing) {
      return sendError(res, 409, "Conflict", "Phone already in use");
    }
  }

  const user = await User.findById(req.userId);
  if (!user) return sendError(res, 404, "Not found", "User not found");

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) {
    user.address = {
      ...(user.address?.toObject ? user.address.toObject() : user.address || {}),
      ...address,
    };
  }
  await user.save();

  return sendSuccess(res, 200, { user });
}

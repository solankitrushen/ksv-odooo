import Discount from "../Schema/Discount.js";
import MenuItem from "../Schema/MenuItem.js";
import Combo from "../Schema/Combo.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";

async function validateTargets(applicableTo, itemIds, comboIds) {
  if (applicableTo === "items" || applicableTo === "both") {
    if (itemIds.length) {
      const n = await MenuItem.countDocuments({ _id: { $in: itemIds } });
      if (n !== itemIds.length) {
        return "One or more menu items not found";
      }
    }
  }
  if (applicableTo === "combos" || applicableTo === "both") {
    if (comboIds.length) {
      const n = await Combo.countDocuments({ _id: { $in: comboIds } });
      if (n !== comboIds.length) {
        return "One or more combos not found";
      }
    }
  }
  return null;
}

export async function listDiscounts(req, res) {
  const discounts = await Discount.find({}).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, 200, { discounts });
}

export async function createDiscount(req, res) {
  const {
    name,
    type,
    value,
    applicableTo,
    itemIds,
    comboIds,
    validFrom,
    validUntil,
  } = req.validated;

  const err = await validateTargets(applicableTo, itemIds, comboIds);
  if (err) return sendError(res, 400, "Validation failed", err);

  const discount = await Discount.create({
    name,
    type,
    value,
    applicableTo,
    targetItemIds: itemIds,
    targetComboIds: comboIds,
    validFrom,
    validUntil,
  });

  return sendSuccess(res, 201, { discount });
}

export async function deactivateDiscount(req, res) {
  const discount = await Discount.findById(req.params.id);
  if (!discount) {
    return sendError(res, 404, "Not found", "Discount not found");
  }
  discount.isActive = false;
  await discount.save();
  return sendSuccess(res, 200, { discount });
}

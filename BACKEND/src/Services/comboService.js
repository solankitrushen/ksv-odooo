import MenuItem from "../Schema/MenuItem.js";
import Combo from "../Schema/Combo.js";
import { sendError } from "../Utils/errorResponse.js";

export async function validateComboItems(items) {
  if (!items?.length || items.length < 2) {
    return { ok: false, message: "Combo must include at least 2 items" };
  }

  const ids = items.map((l) => l.itemId);
  const unique = new Set(ids.map(String));
  if (unique.size < 2) {
    return { ok: false, message: "Combo must include at least 2 distinct items" };
  }

  const found = await MenuItem.find({
    _id: { $in: ids },
    isActive: true,
  }).select("_id");

  if (found.length !== ids.length) {
    return { ok: false, message: "One or more items are missing or inactive" };
  }

  return { ok: true };
}

export async function comboIsAvailable(combo) {
  const ids = combo.items.map((l) => l.itemId);
  const count = await MenuItem.countDocuments({
    _id: { $in: ids },
    isActive: true,
  });
  return count === ids.length;
}

export async function loadComboOr404(res, id) {
  const combo = await Combo.findById(id);
  if (!combo) {
    sendError(res, 404, "Not found", "Combo not found");
    return null;
  }
  return combo;
}

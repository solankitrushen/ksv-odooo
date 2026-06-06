import Combo from "../Schema/Combo.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  validateComboItems,
  loadComboOr404,
} from "../Services/comboService.js";
import {
  getComboRanksMap,
  invalidateSortCache,
} from "../Services/inventorySortService.js";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listCombos(req, res) {
  const q = req.validatedQuery || {};
  const filter = {};

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }
  if (typeof q.active === "boolean") filter.isActive = q.active;

  const page = q.page || 1;
  const pageSize = q.pageSize || 50;
  const skip = (page - 1) * pageSize;
  const sort = q.sort || "createdDesc";

  let combos;
  let total;

  if (sort === "mostSold") {
    const ranks = await getComboRanksMap({
      days: q.rankWindowDays || 30,
    });
    const rankedIds = Array.from(ranks.keys());
    const rankFilter = rankedIds.length
      ? { ...filter, _id: { $in: rankedIds } }
      : filter;
    const rows = await Combo.find(rankFilter).lean();
    rows.sort((a, b) => {
      const ra = ranks.get(String(a._id)) || Number.MAX_SAFE_INTEGER;
      const rb = ranks.get(String(b._id)) || Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    total = rows.length;
    combos = rows.slice(skip, skip + pageSize).map((c) => ({
      ...c,
      salesRank: ranks.get(String(c._id)) || null,
    }));
  } else {
    const mongoSort =
      sort === "nameAsc"
        ? { name: 1 }
        : sort === "priceAsc"
        ? { comboPrice: 1 }
        : sort === "priceDesc"
        ? { comboPrice: -1 }
        : { createdAt: -1 };

    [combos, total] = await Promise.all([
      Combo.find(filter).sort(mongoSort).skip(skip).limit(pageSize).lean(),
      Combo.countDocuments(filter),
    ]);
  }

  return sendSuccess(res, 200, {
    combos,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

export async function createCombo(req, res) {
  const check = await validateComboItems(req.validated.items);
  if (!check.ok) {
    return sendError(res, 400, "Validation failed", check.message);
  }

  const combo = await Combo.create({
    name: req.validated.name,
    description: req.validated.description,
    items: req.validated.items.map((l) => ({
      itemId: l.itemId,
      qty: l.qty,
    })),
    comboPrice: req.validated.comboPrice,
  });

  return sendSuccess(res, 201, { combo });
}

export async function updateCombo(req, res) {
  const combo = await loadComboOr404(res, req.params.id);
  if (!combo) return;

  if (req.validated.items) {
    const check = await validateComboItems(req.validated.items);
    if (!check.ok) {
      return sendError(res, 400, "Validation failed", check.message);
    }
    combo.items = req.validated.items.map((l) => ({
      itemId: l.itemId,
      qty: l.qty,
    }));
  }

  if (req.validated.name !== undefined) combo.name = req.validated.name;
  if (req.validated.description !== undefined) {
    combo.description = req.validated.description;
  }
  if (req.validated.comboPrice !== undefined) {
    combo.comboPrice = req.validated.comboPrice;
  }

  await combo.save();
  return sendSuccess(res, 200, { combo });
}

export async function deactivateCombo(req, res) {
  const combo = await loadComboOr404(res, req.params.id);
  if (!combo) return;

  combo.isActive = false;
  await combo.save();
  return sendSuccess(res, 200, { combo });
}

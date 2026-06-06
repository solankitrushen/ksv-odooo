import fs from "fs";
import path from "path";
import MenuItem from "../Schema/MenuItem.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { getMenuUploadDir, publicImagePath } from "../Utils/menuPaths.js";
import {
  isCloudinaryEnabled,
  uploadImageBuffer,
  deleteImageByUrl,
} from "../Services/cloudinaryService.js";
import {
  recordCategoryUse,
  listRecentCategories,
  listAllCategories,
  deleteCategoryBySlug,
  deactivateCategoryIfUnused,
} from "../Services/menuCategoryService.js";
import {
  getItemRanksMap,
  invalidateSortCache,
} from "../Services/inventorySortService.js";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadItemOr404(res, id) {
  const item = await MenuItem.findById(id);
  if (!item) {
    sendError(res, 404, "Not found", "Menu item not found");
    return null;
  }
  return item;
}

function removeFileIfExists(imagePath) {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  const full = path.join(getMenuUploadDir(), filename);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export async function listMenuItems(req, res) {
  const q = req.validatedQuery || {};
  const filter = {};

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ name: rx }, { description: rx }, { tags: rx }];
  }
  if (q.category) filter.category = q.category;
  if (typeof q.active === "boolean") filter.isActive = q.active;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }

  const page = q.page || 1;
  const pageSize = q.pageSize || 50;
  const skip = (page - 1) * pageSize;
  const sort = q.sort || "createdDesc";

  let items;
  let total;

  if (sort === "mostSold") {
    const ranks = await getItemRanksMap({
      days: q.rankWindowDays || 30,
    });
    const rankedIds = Array.from(ranks.keys());
    const rankFilter = rankedIds.length
      ? { ...filter, _id: { $in: rankedIds } }
      : filter;
    const rows = await MenuItem.find(rankFilter).lean();
    rows.sort((a, b) => {
      const ra = ranks.get(String(a._id)) || Number.MAX_SAFE_INTEGER;
      const rb = ranks.get(String(b._id)) || Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    total = rows.length;
    items = rows.slice(skip, skip + pageSize).map((i) => {
      const json = new MenuItem(i).toPublicJSON();
      json.salesRank = ranks.get(String(i._id)) || null;
      return json;
    });
  } else {
    const mongoSort =
      sort === "nameAsc"
        ? { name: 1 }
        : sort === "priceAsc"
        ? { price: 1 }
        : sort === "priceDesc"
        ? { price: -1 }
        : { createdAt: -1 };

    [items, total] = await Promise.all([
      MenuItem.find(filter)
        .sort(mongoSort)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      MenuItem.countDocuments(filter),
    ]);
    items = items.map((i) => new MenuItem(i).toPublicJSON());
  }

  return sendSuccess(res, 200, {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function createMenuItem(req, res) {
  const item = await MenuItem.create(req.validated);
  // Record all categories in the MenuCategory collection
  await Promise.all(
    (item.categories?.length ? item.categories : [item.category]).map(recordCategoryUse)
  );
  invalidateSortCache();
  return sendSuccess(res, 201, { item: item.toPublicJSON() });
}

export async function updateMenuItem(req, res) {
  const item = await loadItemOr404(res, req.params.id);
  if (!item) return;

  const prevCategories = item.categories?.length ? item.categories : [item.category];
  Object.assign(item, req.validated);
  await item.save();

  const newCategories = item.categories?.length ? item.categories : [item.category];
  const added = newCategories.filter((c) => !prevCategories.includes(c));
  const removed = prevCategories.filter((c) => !newCategories.includes(c));
  await Promise.all(added.map(recordCategoryUse));
  await Promise.all(removed.map(deactivateCategoryIfUnused));

  invalidateSortCache();
  return sendSuccess(res, 200, { item: item.toPublicJSON() });
}

export async function deactivateMenuItem(req, res) {
  const item = await loadItemOr404(res, req.params.id);
  if (!item) return;

  item.isActive = false;
  await item.save();
  const cats = item.categories?.length ? item.categories : [item.category];
  await Promise.all(cats.map(deactivateCategoryIfUnused));
  invalidateSortCache();
  return sendSuccess(res, 200, { item: item.toPublicJSON() });
}

export async function activateMenuItem(req, res) {
  const item = await loadItemOr404(res, req.params.id);
  if (!item) return;

  item.isActive = true;
  await item.save();
  const cats = item.categories?.length ? item.categories : [item.category];
  await Promise.all(cats.map(recordCategoryUse));
  invalidateSortCache();
  return sendSuccess(res, 200, { item: item.toPublicJSON() });
}

export async function deleteMenuItem(req, res) {
  const item = await loadItemOr404(res, req.params.id);
  if (!item) return;

  if (item.isActive) {
    return sendError(
      res,
      409,
      "Item is active",
      "Deactivate the item before deleting it."
    );
  }

  try {
    if (item.imageUrl && /^https?:\/\//i.test(item.imageUrl)) {
      await deleteImageByUrl(item.imageUrl).catch(() => null);
    } else if (item.imagePath) {
      removeFileIfExists(item.imagePath);
    }
  } catch (_err) {
    // image cleanup failure must not block delete
  }

  const cats = item.categories?.length ? item.categories : [item.category];
  await item.deleteOne();
  await Promise.all(cats.map(deactivateCategoryIfUnused));
  invalidateSortCache();
  return sendSuccess(res, 200, { deleted: true, id: req.params.id });
}

export async function getRecentCategories(req, res) {
  const limit = req.validatedQuery?.limit || 20;
  const rows = await listRecentCategories(limit);
  return sendSuccess(res, 200, { categories: rows });
}

export async function ensureCategory(req, res) {
  const name = String(req.body?.name ?? "").trim();
  if (!name || name.length > 80) {
    return sendError(res, 400, "Validation failed", "name required, max 80 chars");
  }
  const cat = await recordCategoryUse(name);
  return sendSuccess(res, 200, { category: cat });
}

export async function getAllCategories(req, res) {
  const rows = await listAllCategories();
  return sendSuccess(res, 200, { categories: rows });
}

export async function deleteCategory(req, res) {
  const { slug } = req.params;
  if (!slug) return sendError(res, 400, "Validation failed", "slug required");
  const deleted = await deleteCategoryBySlug(slug);
  if (!deleted) return sendError(res, 404, "Not found", "Category not found");
  return sendSuccess(res, 200, { deleted: true, name: deleted.name });
}

export async function uploadMenuItemImage(req, res) {
  const item = await loadItemOr404(res, req.params.id);
  if (!item) return;

  if (!req.file) {
    return sendError(res, 400, "Validation failed", "Image file required");
  }

  const previousUrl = item.imageUrl;
  const previousPath = item.imagePath;

  try {
    if (req.file.buffer && isCloudinaryEnabled()) {
      const url = await uploadImageBuffer(req.file.buffer, {
        mimetype: req.file.mimetype,
        folder: "instacafe/menu",
      });
      if (url) {
        item.imageUrl = url;
        item.imagePath = url;
        if (previousUrl) await deleteImageByUrl(previousUrl);
      }
    } else if (req.file.filename) {
      item.imagePath = publicImagePath(req.file.filename);
      item.imageUrl = item.imagePath;
      if (previousPath && previousPath !== item.imagePath) {
        removeFileIfExists(previousPath);
      }
    } else {
      return sendError(res, 400, "Validation failed", "Invalid upload");
    }

    await item.save();
    return sendSuccess(res, 200, { item: item.toPublicJSON() });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw err;
  }
}

export async function deleteMenuItemImage(req, res) {
  const item = await loadItemOr404(res, req.params.id);
  if (!item) return;

  if (item.imagePath) {
    removeFileIfExists(item.imagePath);
    item.imagePath = null;
    await item.save();
  }
  return sendSuccess(res, 200, { item: item.toPublicJSON() });
}

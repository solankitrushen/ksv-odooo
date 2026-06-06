import MenuCategory, { slugifyCategory } from "../Schema/MenuCategory.js";
import MenuItem from "../Schema/MenuItem.js";

export async function recordCategoryUse(rawName) {
  if (!rawName) return null;
  const name = String(rawName).trim();
  if (!name) return null;
  const slug = slugifyCategory(name);
  const updated = await MenuCategory.findOneAndUpdate(
    { slug },
    {
      $set: { name, slug, lastUsedAt: new Date(), isActive: true },
      $inc: { usageCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return updated;
}

export async function listRecentCategories(limit = 20) {
  return MenuCategory.find({ isActive: true })
    .sort({ lastUsedAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();
}

export async function listAllCategories() {
  return MenuCategory.find()
    .sort({ name: 1 })
    .lean();
}

export async function deleteCategoryBySlug(slug) {
  const cat = await MenuCategory.findOne({ slug });
  if (!cat) return null;
  await cat.deleteOne();
  // Remove this category from any menu items that still have it
  await MenuItem.updateMany(
    { categories: cat.name },
    { $pull: { categories: cat.name } }
  );
  return cat;
}

export async function backfillFromMenuItems() {
  const rows = await MenuItem.aggregate([
    { $match: { category: { $nin: [null, ""] } } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        lastUsedAt: { $max: "$updatedAt" },
      },
    },
  ]);

  await Promise.all(
    rows.map((row) => {
      const slug = slugifyCategory(row._id);
      return MenuCategory.updateOne(
        { slug },
        {
          $set: {
            name: row._id,
            slug,
            lastUsedAt: row.lastUsedAt || new Date(),
            isActive: true,
          },
          $setOnInsert: { usageCount: 0 },
          $max: { usageCount: row.count },
        },
        { upsert: true }
      );
    })
  );
  return rows.length;
}

export async function deactivateCategoryIfUnused(name) {
  if (!name) return;
  const stillUsed = await MenuItem.exists({ category: name, isActive: true });
  if (!stillUsed) {
    const slug = slugifyCategory(name);
    await MenuCategory.updateOne({ slug }, { $set: { isActive: false } });
  }
}

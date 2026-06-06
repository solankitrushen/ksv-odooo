import mongoose from "mongoose";

const menuCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
    slug: { type: String, required: true, trim: true, maxlength: 100, unique: true, index: true },
    usageCount: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuCategorySchema.index({ isActive: 1, lastUsedAt: -1 });

export function slugifyCategory(raw) {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

menuCategorySchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    usageCount: this.usageCount,
    lastUsedAt: this.lastUsedAt,
    isActive: this.isActive,
  };
};

const MenuCategory =
  mongoose.models.InstaMenuCategory ||
  mongoose.model("InstaMenuCategory", menuCategorySchema);

export default MenuCategory;

import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    price: { type: Number, required: true, min: 0.01 },
    // Primary category string kept for backward compat (orders, cart, filters)
    category: { type: String, required: true, trim: true, index: true },
    // Multi-category support — category is always categories[0]
    categories: [{ type: String, trim: true, index: true }],
    tags: [{ type: String, trim: true }],
    imagePath: { type: String, default: null },
    imageUrl: { type: String, default: null },
    stock: { type: Number, min: 0, default: 999 },
    stockReserved: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

menuItemSchema.index({ isActive: 1, category: 1 });
menuItemSchema.index({ isActive: 1, category: 1, name: 1 });
menuItemSchema.index({ isActive: 1, categories: 1 });
menuItemSchema.index({ name: "text", description: "text", tags: "text" });

// Keep category in sync with categories[0]
menuItemSchema.pre("save", function (next) {
  if (this.categories && this.categories.length > 0) {
    this.category = this.categories[0];
  } else if (this.category) {
    this.categories = [this.category];
  }
  next();
});

menuItemSchema.methods.toPublicJSON = function toPublicJSON(pricing = null) {
  const base = {
    id: this._id,
    name: this.name,
    description: this.description,
    category: this.category,
    categories: this.categories?.length ? this.categories : [this.category],
    tags: this.tags || [],
    imagePath: this.imagePath,
    imageUrl: this.imageUrl || this.imagePath,
    stockAvailable: Math.max(0, (this.stock || 0) - (this.stockReserved || 0)),
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
  if (pricing) {
    return {
      ...base,
      originalPrice: pricing.originalPrice,
      appliedPrice: pricing.appliedPrice,
      discountApplied: pricing.discountApplied,
    };
  }
  return { ...base, price: this.price };
};

const MenuItem =
  mongoose.models.InstaMenuItem ||
  mongoose.model("InstaMenuItem", menuItemSchema);

export default MenuItem;

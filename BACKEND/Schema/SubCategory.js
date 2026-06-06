const mongoose = require("mongoose");

const SubVariantsSchema = new mongoose.Schema({
  variantId: {
    type: Number, // You can change the type based on your requirements (String, etc.)
    required: true,
  },
  variantName: {
    type: String,
    required: true,
  },
});

const SubCategorySchema = new mongoose.Schema({
  productId: { type: Number, required: true },
  Variants: [SubVariantsSchema], // Array of variants using the variantSchema
});

const SubCategory = mongoose.model("SubCategory", SubCategorySchema);

module.exports = SubCategory;

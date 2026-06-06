import mongoose from "mongoose";

const productSchema = mongoose.Schema({
  productId: {
    type: Number,
    unique: true,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    required: true,
  },
  actualQuantity: {
    type: Number,
    default: 1,
  },
  quantityInStock: {
    type: Number,
    default: 0,
    required: true,
  },
  minQty: {
    type: Number,
    default: 0,
  },
  productImgName: {
    type: String,
    required: true,
  },
  productImgPath: {
    type: String,
    required: true,
  },
});

const Products = mongoose.model("Products", productSchema);

export default Products;

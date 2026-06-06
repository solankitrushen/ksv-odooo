import mongoose from "mongoose";

const productSchema = mongoose.Schema({
  productId: {
    type: Number,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  productImgName: {
    type: String,
    required: true,
  },
  productImgPath: {
    type: String,
    required: true,
  },
  actualQuantity: {
    type: Number, // You can adjust the type based on your actual data
  },
});

const cartSchema = mongoose.Schema({
  cartId: {
    type: Number,
    required: true,
    unique: true,
  },
  Products: {
    type: [productSchema],
    default: () => [],
  },
});

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;

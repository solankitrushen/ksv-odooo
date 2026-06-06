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
  category: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  productImgPath: {
    type: String,
    required: true,
  },
  actualQuantity: {
    type: Number,
    minimum: 1,
  },
  updatedQuantity: {
    type: Number,
    minimum: 1,
    default: 0,
  },
  Status: {
    type: String,
    required: true,
    default: "pending",
    enum: ["approved", "canceled", "pending"],
  },
  remarks: {
    type: String,
    default: "",
    // required: true,
  },
});

const OrderSchema = mongoose.Schema(
  {
    cartId: {
      type: Number,
      required: true,
    },
    orderId: {
      type: Number,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    Status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "approved", "canceled", "attended"],
    },
    EmployeeNotification: {
      type: Boolean,
      required: true,
      default: "false",
    },
    ShopkeeperNotification: {
      type: Boolean,
      required: true,
      default: "false",
    },
    products: [productSchema],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

const Order = mongoose.model("Orders", OrderSchema);

export default Order;

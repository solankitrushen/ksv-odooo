import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaOrder",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["assigned", "picked_up", "in_transit", "delivered"],
      default: "assigned",
    },
    driverName: String,
    estimatedMinutes: Number,
  },
  { timestamps: true }
);

const Delivery =
  mongoose.models.InstaDelivery ||
  mongoose.model("InstaDelivery", deliverySchema);
export default Delivery;

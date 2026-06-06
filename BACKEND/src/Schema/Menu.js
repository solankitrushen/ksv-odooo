import mongoose from "mongoose";

const menuSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaStore",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: String,
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Menu =
  mongoose.models.InstaMenu || mongoose.model("InstaMenu", menuSchema);
export default Menu;

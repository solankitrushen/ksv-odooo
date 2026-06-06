import mongoose from "mongoose";

const categorySchema = mongoose.Schema({
  categoryId: {
    type: Number,
    unique: true,
    required: true,
  },
  categoryName: {
    type: String,
    required: true,
  },
  categoryImgName: {
    type: String,
    required: true,
  },
  categoryImgPath: {
    type: String,
    required: true,
  },
});

const categories = mongoose.model("categories", categorySchema);

export default categories;

import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  productId: { type: Number, required: true },
  productName: { type: String, required: true },
  productCategory: { type: String, required: true },
  productQuantity: { type: Number, required: true },
  productImg: String, // You can store the image path as a string
});

const surveySchema = new mongoose.Schema(
  {
    surveyId: { type: Number, required: true, unique: true },
    empId: { type: Number, required: true },
    name: { type: String, required: true },
    department: { type: String, required: true },
    mobileNo: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          // You can customize the validation logic for mobileNo here
          // For example, to ensure it contains only digits and is exactly 10 characters long:
          return /^\d{10}$/.test(value);
        },
        message: "Mobile No must contain exactly 10 digits",
      },
    },
    email: {
      type: String,
      required: true,
      
      validate: {
        validator: function (value) {
          return /^\S+@\S+\.\S+$/.test(value);
        },
        message: "Invalid email format",
      },
    },
    products: [productSchema],
  },
  { timestamps: true }
);

const Survey = mongoose.model("SurveyForms", surveySchema);

export default Survey;

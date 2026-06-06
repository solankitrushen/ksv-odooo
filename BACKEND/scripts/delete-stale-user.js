import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/Schema/User.js";

const TARGET_ID = "6a17387131be5fb2a476dcbe";

await mongoose.connect(process.env.MONGODB_URI);
const u = await User.findById(TARGET_ID).lean();
console.log("Found:", u ? { id: u._id, email: u.email, phone: u.phone, isVerified: u.isVerified } : "none");
if (u) {
  await User.deleteOne({ _id: TARGET_ID });
  console.log("Deleted.");
}
await mongoose.disconnect();

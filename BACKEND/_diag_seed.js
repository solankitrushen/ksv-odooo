import "dotenv/config";
import { connectDB, disconnectDB } from "./src/db.js";
import Store from "./src/Schema/Store.js";

const EMAIL = "diagtest@store.com";
const PASSWORD = "DiagTest@12345";

await connectDB();
await Store.deleteOne({ email: EMAIL });
const store = await Store.create({
  name: "Diag Test Store",
  phone: "9990001234",
  email: EMAIL,
  password: PASSWORD,
  address: { street: "Diag St", city: "Testville", state: "TS", pincode: "100001" },
  isVerified: true,
  isActive: true,
});
console.log("CREATED", store._id.toString(), EMAIL, PASSWORD);
await disconnectDB();

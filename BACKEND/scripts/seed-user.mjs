import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/Schema/User.js";

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL);

const EMAIL = "testuser@instacafe.in";
const PASSWORD = "User@1234";

// Store is at (23.0276, 72.5871). This home is ~2 km away → inside the 3 km
// free-delivery radius and well within the 10 km max radius.
const home = {
  label: "Home",
  houseNo: "12",
  building: "Sunrise Apartments",
  street: "Prahlad Nagar Road",
  area: "Prahlad Nagar",
  city: "Ahmedabad",
  zipCode: "380015",
  landmark: "Near Vodafone House",
  latitude: 23.0386,
  longitude: 72.596,
  isDefault: true,
};

let user = await User.findOne({ email: EMAIL });
if (user) {
  user.name = "Test Customer";
  user.password = PASSWORD;
  user.primaryIdentifier = "email";
  user.isVerified = true;
  user.isActive = true;
  user.addresses = [home];
  user.markModified("addresses");
  await user.save();
  console.log("Updated user:", String(user._id));
} else {
  user = await User.create({
    name: "Test Customer",
    email: EMAIL,
    password: PASSWORD,
    primaryIdentifier: "email",
    isVerified: true,
    isActive: true,
    addresses: [home],
  });
  console.log("Created user:", String(user._id));
}

console.log("\n=== Test customer ready ===");
console.log({ id: String(user._id), email: EMAIL, password: PASSWORD, home: `${home.latitude},${home.longitude} (~2km from store)` });
await mongoose.disconnect();

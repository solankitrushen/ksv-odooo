import "dotenv/config";
import mongoose from "mongoose";
import Store from "../src/Schema/Store.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
await mongoose.connect(uri);

const EMAIL = "ahmedabad@instacafe.in";
const PASSWORD = "StorePass@123";

const data = {
  name: "InstaCafe Ahmedabad",
  phone: "9000000007",
  email: EMAIL,
  password: PASSWORD,
  address: {
    street: "Sarkhej–Gandhinagar Highway",
    city: "Ahmedabad",
    zipCode: "380007",
    landmark: "Near Prahlad Nagar",
  },
  owner: { name: "Cafe Owner", phone: "9000000007" },
  // From the current public IP geolocation (Ahmedabad, Gujarat, IN).
  location: { latitude: 23.0276, longitude: 72.5871 },
  cuisineTypes: ["north-indian", "beverages"],
  // Sensible delivery config so nearby addresses can actually order.
  ordering: {
    minOrderValue: 200,
    freeDeliveryThreshold: 399,
    deliveryFee: 40,
    freeRadiusKm: 3,
    maxRadiusKm: 10,
    perKmFee: 15,
  },
  // Test-mode payments: no Razorpay Route onboarding → platform/test path
  // (dev uses ORDER_AUTO_PAYMENT_SUCCESS=true; commissionPercent stays 15%).
  razorpay: { onboardingStatus: "pending", commissionPercent: 15 },
  isVerified: true,
  isActive: true,
  subscriptionStatus: "active",
};

let store = await Store.findOne({ email: EMAIL });
if (store) {
  Object.assign(store, data);
  store.password = PASSWORD; // re-hash via pre-save hook
  await store.save();
  console.log("Updated existing store:", String(store._id));
} else {
  store = await Store.create(data);
  console.log("Created store:", String(store._id));
}

console.log("\n=== Store ready ===");
console.log({
  id: String(store._id),
  name: store.name,
  email: EMAIL,
  password: PASSWORD,
  location: store.location,
  ordering: store.ordering,
  isVerified: store.isVerified,
  isActive: store.isActive,
});
console.log("\nLogin at store-admin (port 3002) / store app (3001) with the email + password above.");

await mongoose.disconnect();

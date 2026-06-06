import request from "supertest";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";
import Store from "../../src/Schema/Store.js";
import {
  cookieHeader,
  loginAdmin,
  registerUserPhone,
  VALID_PASSWORD,
  STORE_PASSWORD,
} from "./authHelpers.js";

export async function freshApiContext(app) {
  await ensureDefaultAdmin();
  const admin = await loginAdmin(app);
  const user = await registerUserPhone(app);

  const storeEmail = `store${Date.now()}@example.com`;
  const storePhone = `9${String(Date.now()).slice(-9)}`;
  const storeReg = await request(app)
    .post("/api/v1/auth/store/register")
    .send({
      name: "Test Store",
      phone: storePhone,
      email: storeEmail,
      password: STORE_PASSWORD,
      confirmPassword: STORE_PASSWORD,
      address: { street: "1 Main St", city: "City", zipCode: "380001" },
      location: { latitude: 19.076, longitude: 72.8777 },
    });

  // Stores now require admin verification before login is allowed.
  // Bypass synchronously in tests via direct DB update.
  await Store.updateOne(
    { email: storeEmail },
    { $set: { isVerified: true } }
  );

  const storeLogin = await request(app)
    .post("/api/v1/auth/store/login")
    .send({ email: storeEmail, password: STORE_PASSWORD });

  return {
    adminCookie: admin.cookie,
    userCookie: user.cookie,
    storeCookie: cookieHeader(storeLogin.headers["set-cookie"]),
    storeEmail,
    userPhone: user.phone,
    password: VALID_PASSWORD,
    storePassword: STORE_PASSWORD,
    storeReg,
    storeLogin,
  };
}

export async function createMenuItem(app, adminCookie, overrides = {}) {
  return request(app)
    .post("/api/v1/admin/items")
    .set("Cookie", adminCookie)
    .send({
      name: "Test Item",
      description: "Desc",
      price: 250,
      category: "Lunch",
      tags: ["veg"],
      ...overrides,
    });
}

import jwt from "jsonwebtoken";
import request from "supertest";

export const VALID_PASSWORD = "TestPass@123";
export const STORE_PASSWORD = "StorePass@123";

export function cookieHeader(setCookie) {
  if (!setCookie?.length) return "";
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

export async function loginAdmin(app) {
  const res = await request(app)
    .post("/api/v1/auth/admin/login")
    .send({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
  return { res, cookie: cookieHeader(res.headers["set-cookie"]) };
}

export async function registerUserPhone(app) {
  const phone = `9${String(Date.now()).slice(-9)}`;
  const res = await request(app)
    .post("/api/v1/auth/user/register")
    .send({
      name: "Menu User",
      phone,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
  return {
    res,
    cookie: cookieHeader(res.headers["set-cookie"]),
    phone,
    password: VALID_PASSWORD,
  };
}

export async function registerUserEmail(app, email) {
  return request(app)
    .post("/api/v1/auth/user/register")
    .send({
      name: "Email User",
      email,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
}

export function signTestJwt(payload, options = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
    ...options,
  });
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

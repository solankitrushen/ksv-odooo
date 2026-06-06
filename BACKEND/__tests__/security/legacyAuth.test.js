import { describe, it, expect, beforeAll } from "@jest/globals";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import bcrypt from "bcrypt";
import { connectDB } from "../../src/db.js";
import legacyRouter from "../../legacyRouter.js";
import registerUsers from "../../Schema/register.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/legacy/ims", legacyRouter);
  return app;
}

describe("Legacy IMS hardening", () => {
  let app;

  beforeAll(async () => {
    await connectDB();
    app = makeApp();
  });

  it("hashes passwords on save and verifies via comparePassword", async () => {
    const email = `emp_${Date.now()}@test.com`;
    const user = await registerUsers.create({
      username: `u_${Date.now()}`,
      fullName: "Tester",
      dept: "QA",
      email,
      password: "PlainSecret123!",
      panel: "Employee",
    });
    expect(user.password).toMatch(/^\$2[aby]\$/);
    const fresh = await registerUsers
      .findOne({ email })
      .select("+password");
    expect(await fresh.comparePassword("PlainSecret123!")).toBe(true);
    expect(await fresh.comparePassword("wrong")).toBe(false);
  });

  it("refuses cart access without legacy auth cookie", async () => {
    const res = await request(app).get("/legacy/ims/GetCarts");
    expect(res.status).toBe(401);
  });

  it("refuses login on wrong credentials with generic 401", async () => {
    const res = await request(app)
      .post("/legacy/ims/employeeLogin")
      .send({ email: "nobody@test.com", password: "x" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid credentials/);
  });
});

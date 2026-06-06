import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

const validPassword = "TestPass@123";

describe("User auth /api/v1/auth/user", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("registers with phone and gets session", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Phone User",
        phone: "9876543210",
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.phone).toBe("9876543210");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("registers with email — pending OTP, no session cookies required", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Email User",
        email: "john@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.pendingVerification).toBe(true);
    expect(res.body.data.userId).toBeDefined();
  });

  it("duplicate email register returns 201 (enumeration safe)", async () => {
    await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Dup",
        email: "dup@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const res = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Dup2",
        email: "dup@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.pendingVerification).toBe(true);
  });

  it("verify email OTP then login", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Verify Me",
        email: "verify@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const userId = reg.body.data.userId;

    const { default: User } = await import("../../src/Schema/User.js");
    const user = await User.findById(userId).select("+verificationToken");
    const otp = user.verificationToken;

    const verify = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp });

    expect(verify.status).toBe(200);

    const login = await request(app)
      .post("/api/v1/auth/user/login")
      .send({ email: "verify@example.com", password: validPassword });

    expect(login.status).toBe(200);
    expect(login.body.data.tokens.accessToken).toBeDefined();
  });

  it("blocks unverified email login", async () => {
    await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Unverified",
        email: "unverified@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const res = await request(app)
      .post("/api/v1/auth/user/login")
      .send({ email: "unverified@example.com", password: validPassword });

    expect(res.status).toBe(403);
  });

  it("specific error for wrong password", async () => {
    await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Login Test",
        phone: "9111111111",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const res = await request(app)
      .post("/api/v1/auth/user/login")
      .send({ phone: "9111111111", password: "WrongPass@999" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/incorrect password/i);
  });
});

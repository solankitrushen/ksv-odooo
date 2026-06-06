import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

const validPassword = "TestPass@123";

describe("User forgot/reset password /api/v1/auth/user", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("forgot password sends OTP (enumeration safe)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "nonexistent@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("If account exists");
  });

  it("forgot password for verified user sends OTP", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Reset User",
        email: "reset@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    const verifyOtp = user.verificationToken;

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: verifyOtp });

    const forgot = await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "reset@example.com" });

    expect(forgot.status).toBe(200);
    expect(forgot.body.data.message).toContain("If account exists");

    user = await User.findById(userId).select("+passwordResetOTP");
    expect(user.passwordResetOTP).toBeDefined();
  });

  it("reset password with valid OTP", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Reset Valid",
        email: "resetvalid@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: user.verificationToken });

    await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "resetvalid@example.com" });

    user = await User.findById(userId).select("+passwordResetOTP");
    const resetOtp = user.passwordResetOTP;

    const reset = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "resetvalid@example.com",
        otp: resetOtp,
        newPassword: "NewPass@456",
      });

    expect(reset.status).toBe(200);
    expect(reset.body.data.message).toContain("Password reset");

    const login = await request(app)
      .post("/api/v1/auth/user/login")
      .send({ email: "resetvalid@example.com", password: "NewPass@456" });

    expect(login.status).toBe(200);
  });

  it("reset password rejects invalid OTP", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Reset Invalid",
        email: "resetinvalid@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: user.verificationToken });

    await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "resetinvalid@example.com" });

    const reset = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "resetinvalid@example.com",
        otp: "000000",
        newPassword: "NewPass@456",
      });

    expect(reset.status).toBe(400);
    expect(reset.body.error).toContain("Invalid OTP");
  });

  it("reset password locks after 5 failed attempts", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Reset Lock",
        email: "resetlock@example.com",
        password: validPassword,
        confirmPassword: validPassword,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: user.verificationToken });

    await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "resetlock@example.com" });

    for (let i = 0; i < 4; i++) {
      await request(app)
        .post("/api/v1/auth/user/reset-password")
        .send({
          email: "resetlock@example.com",
          otp: "000000",
          newPassword: "NewPass@456",
        });
    }

    const final = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "resetlock@example.com",
        otp: "000000",
        newPassword: "NewPass@456",
      });

    expect(final.status).toBe(429);
    expect(final.body.error).toContain("Locked");
  });

  it("reset password rejects short password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "test@example.com",
        otp: "123456",
        newPassword: "short",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation");
    expect(res.body.message).toContain("min 8 chars");
  });

  it("reset password requires all fields", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation");
    expect(res.body.message).toContain("required");
  });
});

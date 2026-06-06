import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

const password = "TestPass@123";

describe("Password reset security", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("forgot password does not leak user existence", async () => {
    const exists = await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "exists@example.com" });

    const notExists = await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "notexists@example.com" });

    expect(exists.status).toBe(200);
    expect(notExists.status).toBe(200);
    expect(exists.body.data.message).toBe(notExists.body.data.message);
  });

  it("reset password OTP expires after 10 minutes", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Expire Test",
        email: "expire@example.com",
        password,
        confirmPassword: password,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: user.verificationToken });

    await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "expire@example.com" });

    user = await User.findById(userId).select("+passwordResetOTP +passwordResetExpiry");
    const otp = user.passwordResetOTP;

    user.passwordResetExpiry = new Date(Date.now() - 1000);
    await user.save();

    const reset = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "expire@example.com",
        otp,
        newPassword: "NewPass@456",
      });

    expect(reset.status).toBe(400);
    expect(reset.body.error).toContain("Expired");
  });

  it("reset password clears OTP after successful reset", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Clear OTP",
        email: "clearotp@example.com",
        password,
        confirmPassword: password,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: user.verificationToken });

    await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "clearotp@example.com" });

    user = await User.findById(userId).select("+passwordResetOTP");
    const otp = user.passwordResetOTP;

    await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "clearotp@example.com",
        otp,
        newPassword: "NewPass@456",
      });

    user = await User.findById(userId).select("+passwordResetOTP +passwordResetExpiry +passwordResetAttempts");
    expect(user.passwordResetOTP).toBeUndefined();
    expect(user.passwordResetExpiry).toBeUndefined();
    expect(user.passwordResetAttempts).toBe(0);
  });

  it("reset password rejects reused OTP", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Reuse OTP",
        email: "reuseotp@example.com",
        password,
        confirmPassword: password,
      });

    const userId = reg.body.data.userId;
    const { default: User } = await import("../../src/Schema/User.js");
    let user = await User.findById(userId).select("+verificationToken");
    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: user.verificationToken });

    await request(app)
      .post("/api/v1/auth/user/forgot-password")
      .send({ email: "reuseotp@example.com" });

    user = await User.findById(userId).select("+passwordResetOTP");
    const otp = user.passwordResetOTP;

    await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "reuseotp@example.com",
        otp,
        newPassword: "NewPass@456",
      });

    const reuse = await request(app)
      .post("/api/v1/auth/user/reset-password")
      .send({
        email: "reuseotp@example.com",
        otp,
        newPassword: "AnotherPass@789",
      });

    expect(reuse.status).toBe(400);
  });
});

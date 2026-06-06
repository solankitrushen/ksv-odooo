import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { constantTimeCompare } from "../../src/Utils/crypto.js";

const password = "TestPass@123";

describe("Auth security", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("constantTimeCompare rejects wrong OTP length safely", () => {
    expect(constantTimeCompare("123456", "123457")).toBe(false);
    expect(constantTimeCompare("123456", "123456")).toBe(true);
  });

  it("locks account after 5 failed logins", async () => {
    await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Lock Test",
        phone: "9222222222",
        password,
        confirmPassword: password,
      });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: "9222222222", password: "WrongPass@999" });
    }

    const res = await request(app)
      .post("/api/v1/auth/user/login")
      .send({ phone: "9222222222", password });

    expect(res.status).toBe(429);
  });

  it("revoked session cannot access /me", async () => {
    const agent = request.agent(app);

    const reg = await agent
      .post("/api/v1/auth/user/register")
      .send({
        name: "Session Test",
        phone: "9333333333",
        password,
        confirmPassword: password,
      });

    expect(reg.status).toBe(201);

    const me1 = await agent.get("/api/v1/auth/me");
    expect(me1.status).toBe(200);

    const sessions = await agent.get("/api/v1/auth/user/sessions");
    const sid = sessions.body.data.sessions.find((s) => s.current)?.tokenId;

    await agent
      .post("/api/v1/auth/user/sessions/revoke")
      .send({ sessionId: sid });

    const me2 = await agent.get("/api/v1/auth/me");
    expect(me2.status).toBe(401);
  });

  it("rejects invalid OTP after verify lock threshold", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "OTP Lock",
        email: "otplock@example.com",
        password,
        confirmPassword: password,
      });

    const userId = reg.body.data.userId;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ userId, otp: "000000" });
    }

    const res = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ userId, otp: "000000" });

    expect(res.status).toBe(429);
  });
});

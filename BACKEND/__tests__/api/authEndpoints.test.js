import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext } from "../helpers/apiTestContext.js";
import {
  VALID_PASSWORD,
  STORE_PASSWORD,
  registerUserEmail,
  bearer,
} from "../helpers/authHelpers.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";
import User from "../../src/Schema/User.js";

describe("API matrix — /api/v1/auth", () => {
  let app;
  let ctx;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
  });

  describe("POST /auth/user/register", () => {
    it("201 phone + session cookies", async () => {
      expect(ctx.userCookie).toMatch(/authToken=/);
    });

    it("201 email pending verification", async () => {
      const res = await registerUserEmail(app, `e${Date.now()}@example.com`);
      expect(res.status).toBe(201);
      expect(res.body.data.pendingVerification).toBe(true);
    });

    it("400 missing identifier", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/register")
        .send({ name: "X", password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/verify-email", () => {
    it("200 valid OTP", async () => {
      const email = `verify${Date.now()}@example.com`;
      const reg = await registerUserEmail(app, email);
      const user = await User.findById(reg.body.data.userId).select("+verificationToken");
      const res = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ userId: reg.body.data.userId, otp: user.verificationToken });
      expect(res.status).toBe(200);
    });

    it("400 invalid userId", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ userId: "bad", otp: "123456" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/resend-otp", () => {
    it("200 for pending email user", async () => {
      const reg = await registerUserEmail(app, `resend${Date.now()}@example.com`);
      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({ userId: reg.body.data.userId });
      expect([200, 429]).toContain(res.status);
    });
  });

  describe("POST /auth/user/login", () => {
    it("200 phone login", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: VALID_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it("401 wrong password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: "WrongPass@999" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/user/login-otp", () => {
    it("400 unknown email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/login-otp")
        .send({ email: "nobody@example.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /auth/user/oauth/google", () => {
    it("503 or 302 when not configured", async () => {
      const res = await request(app).get("/api/v1/auth/user/oauth/google");
      expect([302, 503]).toContain(res.status);
    });
  });

  describe("POST /auth/store/register", () => {
    it("201 new store", async () => {
      expect(ctx.storeReg.status).toBe(201);
      expect(ctx.storeReg.body.data.user.role).toBe("store");
    });
  });

  describe("POST /auth/store/login", () => {
    it("200 valid credentials", async () => {
      expect(ctx.storeLogin.status).toBe(200);
    });
  });

  describe("POST /auth/admin/login", () => {
    it("200 seeded admin", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe("admin");
    });

    it("401 bad password", async () => {
      await ensureDefaultAdmin();
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: process.env.ADMIN_EMAIL, password: "nope" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("200 with user cookie", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe("user");
    });

    it("401 without token", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/user/sessions", () => {
    it("200 lists sessions for user", async () => {
      const res = await request(app)
        .get("/api/v1/auth/user/sessions")
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
    });

    it("403 for store role", async () => {
      const res = await request(app)
        .get("/api/v1/auth/user/sessions")
        .set("Cookie", ctx.storeCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /auth/user/logout", () => {
    it("200 clears session", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/logout")
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /auth/store/logout", () => {
    it("200 for store", async () => {
      const res = await request(app)
        .post("/api/v1/auth/store/logout")
        .set("Cookie", ctx.storeCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /auth/admin/logout", () => {
    it("200 for admin", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/logout")
        .set("Cookie", ctx.adminCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("Bearer token auth", () => {
    it("200 /me with Authorization header", async () => {
      const login = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: VALID_PASSWORD });
      const access = login.body.data.tokens.accessToken;
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(bearer(access));
      expect(res.status).toBe(200);
    });
  });
});

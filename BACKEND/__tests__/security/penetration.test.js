import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import {
  VALID_PASSWORD,
  signTestJwt,
  bearer,
} from "../helpers/authHelpers.js";

/**
 * Third-party attacker scenarios (OWASP-oriented).
 * Expected: no privilege gain, no crash, safe 4xx.
 */
describe("Penetration — InstaCafe /api/v1", () => {
  let app;
  let ctx;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
  });

  describe("A01 Broken access control", () => {
    it("user cannot POST /admin/items", async () => {
      const res = await createMenuItem(app, ctx.userCookie, { name: "Pwned" });
      expect(res.status).toBe(403);
    });

    it("store cannot GET /user/menu", async () => {
      const res = await request(app)
        .get("/api/v1/user/menu")
        .set("Cookie", ctx.storeCookie);
      expect(res.status).toBe(403);
    });

    it("admin cannot GET /user/menu (user-only)", async () => {
      const res = await request(app)
        .get("/api/v1/user/menu")
        .set("Cookie", ctx.adminCookie);
      expect(res.status).toBe(403);
    });

    it("no token → 401 on protected inventory", async () => {
      const res = await request(app).get("/api/v1/user/menu");
      expect(res.status).toBe(401);
    });
  });

  describe("A03 Injection", () => {
    it("NoSQL operator in login body blocked or fails validation", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/login")
        .send({
          email: { $gt: "" },
          password: VALID_PASSWORD,
        });
      expect([400, 401]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it("$where-style name on register → 400 suspicious or validation", async () => {
      const res = await request(app)
        .post("/api/v1/auth/user/register")
        .send({
          name: "'; DROP TABLE users; --",
          phone: `9${Date.now()}`.slice(-9),
          password: VALID_PASSWORD,
          confirmPassword: VALID_PASSWORD,
        });
      expect([400, 201]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.data.user.name).not.toMatch(/DROP TABLE/i);
      }
    });

    it("XSS script in menu description sanitized or stored safe", async () => {
      const payload = '<script>alert("xss")</script>';
      const created = await createMenuItem(app, ctx.adminCookie, {
        description: payload,
      });
      expect(created.status).toBe(201);
      const desc = created.body.data.item.description || "";
      expect(desc).not.toContain("<script>");
    });
  });

  describe("A07 Authentication failures", () => {
    it("tampered JWT signature → 401", async () => {
      const login = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: VALID_PASSWORD });
      const token = login.body.data.tokens.accessToken;
      const parts = token.split(".");
      const bad = `${parts[0]}.${parts[1]}.INVALIDSIG`;
      const res = await request(app).get("/api/v1/auth/me").set(bearer(bad));
      expect(res.status).toBe(401);
    });

    it("forged JWT role=admin with user userId → 401 (no Admin row)", async () => {
      const user = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: VALID_PASSWORD });
      const decoded = jwt.decode(user.body.data.tokens.accessToken);
      const evil = signTestJwt({
        userId: decoded.userId,
        role: "admin",
      });
      const res = await request(app)
        .post("/api/v1/admin/items")
        .set(bearer(evil))
        .send({
          name: "FakeAdmin",
          price: 10,
          category: "X",
        });
      expect(res.status).toBe(401);
    });

    it("expired JWT → 401", async () => {
      const login = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: VALID_PASSWORD });
      const decoded = jwt.decode(login.body.data.tokens.accessToken);
      const expired = signTestJwt(
        { userId: decoded.userId, role: "user", sessionId: decoded.sessionId },
        { expiresIn: "-10s" }
      );
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(bearer(expired));
      expect(res.status).toBe(401);
    });
  });

  describe("A04 / upload abuse", () => {
    it("reject non-image MIME on item image", async () => {
      const item = await createMenuItem(app, ctx.adminCookie);
      const id = item.body.data.item.id;
      const res = await request(app)
        .post(`/api/v1/admin/items/${id}/image`)
        .set("Cookie", ctx.adminCookie)
        .attach("image", Buffer.from("MZ"), {
          filename: "malware.exe",
          contentType: "application/octet-stream",
        });
      expect(res.status).toBe(400);
    });

    it("reject oversized upload (>15MB)", async () => {
      const item = await createMenuItem(app, ctx.adminCookie);
      const id = item.body.data.item.id;
      const big = Buffer.alloc(15 * 1024 * 1024 + 1, 0xff);
      const res = await request(app)
        .post(`/api/v1/admin/items/${id}/image`)
        .set("Cookie", ctx.adminCookie)
        .attach("image", big, {
          filename: "big.png",
          contentType: "image/png",
        });
      expect(res.status).toBe(400);
    });
  });

  describe("Business logic / price tampering", () => {
    it("negative price on create → 400", async () => {
      const res = await createMenuItem(app, ctx.adminCookie, { price: -10 });
      expect(res.status).toBe(400);
    });

    it("client cannot set appliedPrice via API (server computes on GET menu)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/items")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Tamper",
          price: 50,
          category: "X",
          appliedPrice: 1,
        });
      expect(res.status).toBe(201);
      const menu = await request(app)
        .get("/api/v1/user/menu")
        .set("Cookie", ctx.userCookie);
      const row = menu.body.data.menu.find(
        (m) => m.name === "Tamper"
      );
      expect(row.appliedPrice).toBe(50);
    });
  });

  describe("IDOR / path tricks", () => {
    it("invalid ObjectId on PUT item → 404 not 500", async () => {
      const res = await request(app)
        .put("/api/v1/admin/items/not-a-valid-id")
        .set("Cookie", ctx.adminCookie)
        .send({ price: 1 });
      expect([400, 404]).toContain(res.status);
    });
  });
});

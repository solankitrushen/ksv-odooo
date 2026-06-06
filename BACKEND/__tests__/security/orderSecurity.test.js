import { describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { placeOrder } from "../helpers/orderHelpers.js";
import { signTestJwt, bearer, VALID_PASSWORD } from "../helpers/authHelpers.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";
import {
  canStoreTransition,
  isTerminalStatus,
} from "../../src/Services/orderService.js";
import { ORDER_STATUS } from "../../config/constants.js";

describe("SPEC-003-SEC Order security", () => {
  let app;
  let ctx;
  let storeId;
  let itemId;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await ensureDefaultAdmin();
    ctx = await freshApiContext(app);
    storeId = ctx.storeReg.body.data.user.id || ctx.storeReg.body.data.user._id;
    const item = await createMenuItem(app, ctx.adminCookie, { price: 250 });
    itemId = item.body.data.item.id;
  });

  describe("Cat 1 — IDOR", () => {
    it("1.1 user cannot read other user order", async () => {
      const a = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      const other = await freshApiContext(app);
      const res = await request(app)
        .get(`/api/v1/user/orders/${a.body.data.order.id}`)
        .set("Cookie", other.userCookie);
      expect(res.status).toBe(404);
    });

    it("1.4 store cannot reject other store order", async () => {
      const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      const other = await freshApiContext(app);
      const res = await request(app)
        .patch(`/api/v1/store/orders/${created.body.data.order.id}/reject`)
        .set("Cookie", other.storeCookie)
        .send({ reason: "Competitor sabotage attempt here" });
      expect(res.status).toBe(404);
    });

    it("1.6 list limit capped at 50", async () => {
      const res = await request(app)
        .get("/api/v1/user/orders?limit=999")
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(400);
    });
  });

  describe("Cat 2 — Privilege escalation", () => {
    it("2.1 user cannot PATCH accept", async () => {
      const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      const res = await request(app)
        .patch(`/api/v1/store/orders/${created.body.data.order.id}/accept`)
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(403);
    });

    it("2.5 forged admin JWT on store route → 401", async () => {
      const login = await request(app)
        .post("/api/v1/auth/user/login")
        .send({ phone: ctx.userPhone, password: VALID_PASSWORD });
      const decoded = jwt.decode(login.body.data.tokens.accessToken);
      const evil = signTestJwt({ userId: decoded.userId, role: "admin" });
      const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      const res = await request(app)
        .patch(`/api/v1/store/orders/${created.body.data.order.id}/accept`)
        .set(bearer(evil));
      expect(res.status).toBe(401);
    });
  });

  describe("Cat 3 — Status machine", () => {
    it("3.1 cannot jump pending → delivered", async () => {
      const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      const res = await request(app)
        .patch(`/api/v1/store/orders/${created.body.data.order.id}/status`)
        .set("Cookie", ctx.storeCookie)
        .send({ status: "delivered" });
      expect(res.status).toBe(400);
    });

    it("3.2 rejected is terminal", async () => {
      expect(isTerminalStatus(ORDER_STATUS.REJECTED)).toBe(true);
      const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      const id = created.body.data.order.id;
      await request(app)
        .patch(`/api/v1/store/orders/${id}/reject`)
        .set("Cookie", ctx.storeCookie)
        .send({ reason: "Out of stock for all items today" });

      const res = await request(app)
        .patch(`/api/v1/store/orders/${id}/status`)
        .set("Cookie", ctx.storeCookie)
        .send({ status: "preparing" });
      expect(res.status).toBe(400);
    });

    it("3.5 delivery order cannot ready→delivered skip", async () => {
      expect(canStoreTransition("ready", "delivered", "delivery")).toBe(false);
      expect(canStoreTransition("ready", "delivered", "takeaway")).toBe(true);
    });
  });

  describe("Cat 4 — Payment", () => {
    const prevAuto = process.env.ORDER_AUTO_PAYMENT_SUCCESS;

    afterEach(() => {
      process.env.ORDER_AUTO_PAYMENT_SUCCESS = prevAuto;
    });

    it("4.1 cannot accept pending payment", async () => {
      const created = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [{ menuItemId: String(itemId), quantity: 1 }],
        });
      expect(created.status).toBe(201);
      const Order = (await import("../../src/Schema/Order.js")).default;
      await Order.updateOne(
        { _id: created.body.data.order.id },
        { $set: { paymentStatus: "pending" } }
      );

      const res = await request(app)
        .patch(`/api/v1/store/orders/${created.body.data.order.id}/accept`)
        .set("Cookie", ctx.storeCookie);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Payment/i);
    });

    it("4.2 order without verified payment rejected when auto-pay off", async () => {
      process.env.ORDER_AUTO_PAYMENT_SUCCESS = "false";
      const res = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [{ menuItemId: String(itemId), quantity: 1 }],
          paymentStatus: "success",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Payment/i);
    });
  });

  describe("Cat 5 — Injection", () => {
    it("5.2 NoSQL object in userNote rejected", async () => {
      const res = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [{ menuItemId: String(itemId), quantity: 1 }],
          userNote: { $ne: null },
        });
      expect(res.status).toBe(400);
    });

    it("5.4 userNote max 500", async () => {
      const res = await placeOrder(app, ctx.userCookie, {
        storeId,
        itemId,
        overrides: { userNote: "x".repeat(501) },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Cat 9 — Business logic", () => {
    it("9.1 negative qty rejected", async () => {
      const res = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [{ menuItemId: String(itemId), quantity: -1 }],
        });
      expect(res.status).toBe(400);
    });

    it("9.2 client unitPrice ignored", async () => {
      const res = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [
            {
              menuItemId: String(itemId),
              quantity: 1,
              unitPrice: 0.01,
            },
          ],
        });
      expect(res.status).toBe(201);
      // Server prices from the menu (250), ignoring the client-sent unitPrice.
      expect(res.body.data.order.subtotal).toBe(250);
    });

    it("9.3 delivery distance from coords, not client km", async () => {
      const res = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "delivery",
          deliveryLatitude: 19.081,
          deliveryLongitude: 72.882,
          deliveryDistanceKm: 99,
          items: [{ menuItemId: String(itemId), quantity: 1 }],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.order.deliveryDistanceKm).toBeLessThanOrEqual(1);
      // Within the free radius: only the flat store deliveryFee may apply — never
      // the client-supplied 99 km (which would be a large per-km charge).
      expect(res.body.data.order.deliveryCharge).toBeLessThanOrEqual(40);
    });
  });

  describe("Cat 7 — Data shape", () => {
    it("7.4 response excludes mongoose __v", async () => {
      const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      expect(created.body.data.order.__v).toBeUndefined();
    });
  });
});

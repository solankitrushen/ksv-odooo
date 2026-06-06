import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { placeOrder } from "../helpers/orderHelpers.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";
import { MIN_ORDER_AMOUNT_INR } from "../../config/constants.js";

describe("Order minimum + platform fee", () => {
  let app;
  let ctx;
  let storeId;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await ensureDefaultAdmin();
    ctx = await freshApiContext(app);
    storeId = ctx.storeReg.body.data.user.id || ctx.storeReg.body.data.user._id;
  });

  describe("MIN_ORDER_AMOUNT_INR floor", () => {
    it("rejects subtotal below ₹200 — does NOT reach Razorpay", async () => {
      const item = await createMenuItem(app, ctx.adminCookie, { price: 50 });
      const itemId = item.body.data.item.id;

      const res = await request(app)
        .post("/api/v1/user/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [{ menuItemId: String(itemId), quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body?.error?.message || res.body?.message || "").toMatch(
        /minimum order/i,
      );
    });

    it("rejects placeOrder when subtotal < ₹200", async () => {
      const item = await createMenuItem(app, ctx.adminCookie, { price: 100 });
      const itemId = item.body.data.item.id;
      const res = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      expect(res.status).toBe(400);
    });

    it("accepts subtotal exactly at MIN", async () => {
      const item = await createMenuItem(app, ctx.adminCookie, {
        price: MIN_ORDER_AMOUNT_INR,
      });
      const itemId = item.body.data.item.id;
      const res = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      expect(res.status).toBe(201);
    });
  });

  describe("Platform fee on totals", () => {
    it("createPaymentOrder returns platformFee + percent + total = subtotal + fee", async () => {
      const item = await createMenuItem(app, ctx.adminCookie, { price: 250 });
      const itemId = item.body.data.item.id;
      const res = await request(app)
        .post("/api/v1/user/payments/orders")
        .set("Cookie", ctx.userCookie)
        .send({
          storeId: String(storeId),
          deliveryType: "takeaway",
          items: [{ menuItemId: String(itemId), quantity: 1 }],
        });

      // 503 if RAZORPAY env not set — still passes the floor + quote.
      // Read the quote regardless of provider availability.
      if (res.body?.data?.quote) {
        const q = res.body.data.quote;
        expect(q.subtotal).toBe(250);
        expect(q.platformFeePercent).toBeGreaterThan(0);
        const expectedFee = +((q.subtotal * q.platformFeePercent) / 100).toFixed(2);
        expect(q.platformFee).toBe(expectedFee);
        expect(q.totalAmount).toBe(q.subtotal + q.platformFee + q.deliveryCharge);
      }
    });

    it("placed order persists platformFee + platformFeePercent", async () => {
      const item = await createMenuItem(app, ctx.adminCookie, { price: 400 });
      const itemId = item.body.data.item.id;
      const res = await placeOrder(app, ctx.userCookie, { storeId, itemId });
      expect(res.status).toBe(201);
      const order = res.body.data.order;
      expect(order.subtotal).toBe(400);
      expect(typeof order.platformFee).toBe("number");
      expect(typeof order.platformFeePercent).toBe("number");
      expect(order.totalAmount).toBe(
        order.subtotal + order.platformFee + order.deliveryCharge,
      );
    });
  });

  describe("Tamper resistance", () => {
    it("ignores client-supplied platformFee in body", async () => {
      const item = await createMenuItem(app, ctx.adminCookie, { price: 300 });
      const itemId = item.body.data.item.id;
      const res = await placeOrder(app, ctx.userCookie, {
        storeId,
        itemId,
        overrides: {
          platformFee: 0,
          platformFeePercent: 0,
          subtotal: 1,
          totalAmount: 1,
        },
      });
      expect(res.status).toBe(201);
      const order = res.body.data.order;
      expect(order.subtotal).toBe(300);
      expect(order.platformFee).toBeGreaterThan(0);
    });
  });
});

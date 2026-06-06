import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { placeOrder } from "../helpers/orderHelpers.js";
import crypto from "crypto";
import { verifyPaymentSignature } from "../../src/Services/razorpayService.js";

describe("SPEC-003 v1.1 delivery + payment hardening", () => {
  let app;
  let ctx;
  let storeId;
  let itemId;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
    storeId = ctx.storeReg.body.data.user.id || ctx.storeReg.body.data.user._id;
    const item = await createMenuItem(app, ctx.adminCookie, {
      name: "Radius Item",
      price: 250,
    });
    itemId = item.body.data.item.id;
  });

  it("rejects delivery order beyond 1km", async () => {
    const res = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "delivery",
        deliveryLatitude: 19.12,
        deliveryLongitude: 72.95,
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1 km|radius/i);
  });

  it("allows delivery within 1km and returns OTP", async () => {
    const res = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "delivery",
        deliveryLatitude: 19.081,
        deliveryLongitude: 72.882,
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.order.deliveryType).toBe("delivery");
    expect(res.body.data.order.deliveryOtp).toMatch(/^\d{6}$/);
  });

  it("supports dine_in and takeaway delivery types", async () => {
    for (const deliveryType of ["dine_in", "takeaway"]) {
      const res = await placeOrder(app, ctx.userCookie, {
        storeId,
        itemId,
        overrides: { deliveryType },
      });
      expect(res.status).toBe(201);
      expect(res.body.data.order.deliveryType).toBe(deliveryType);
    }
  });

  it("rejects tampered Razorpay signature when auto-pay off", async () => {
    const prev = process.env.ORDER_AUTO_PAYMENT_SUCCESS;
    process.env.ORDER_AUTO_PAYMENT_SUCCESS = "false";

    const res = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
        razorpayPaymentId: "pay_fake",
        razorpayOrderId: "order_fake",
        razorpaySignature: "bad_signature",
      });

    process.env.ORDER_AUTO_PAYMENT_SUCCESS = prev;
    expect(res.status).toBe(400);
  });

  it("verifyPaymentSignature uses timing-safe compare", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret_for_hmac";
    const orderId = "order_test123";
    const paymentId = "pay_test456";
    const sig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
      })
    ).toBe(true);
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: "wrong",
      })
    ).toBe(false);
  });

  it("complete-delivery requires valid OTP", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "delivery",
        deliveryLatitude: 19.081,
        deliveryLongitude: 72.882,
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const orderId = created.body.data.order.id;
    const otp = created.body.data.order.deliveryOtp;

    const acceptRes = await request(app)
      .patch(`/api/v1/store/orders/${orderId}/accept`)
      .set("Cookie", ctx.storeCookie);
    expect(acceptRes.status).toBe(200);

    const prepRes = await request(app)
      .patch(`/api/v1/store/orders/${orderId}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "preparing" });
    expect(prepRes.status).toBe(200);

    const readyRes = await request(app)
      .patch(`/api/v1/store/orders/${orderId}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "ready" });
    expect(readyRes.status).toBe(200);

    const shipRes = await request(app)
      .patch(`/api/v1/store/orders/${orderId}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "in_delivery" });
    expect(shipRes.status).toBe(200);

    const bad = await request(app)
      .post(`/api/v1/store/orders/${orderId}/complete-delivery`)
      .set("Cookie", ctx.storeCookie)
      .send({
        otp: "000000",
        proofImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg",
      });

    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post(`/api/v1/store/orders/${orderId}/complete-delivery`)
      .set("Cookie", ctx.storeCookie)
      .send({
        otp,
        proofImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg",
      });

    if (ok.status !== 200) {
      throw new Error(
        `complete-delivery failed: ${ok.status} ${JSON.stringify(ok.body)}`
      );
    }
    expect(ok.body.data.order.status).toBe("delivered");
  });

  it("blocks direct delivered status patch for delivery orders", async () => {
    const created = await placeOrder(app, ctx.userCookie, {
      storeId,
      itemId,
      overrides: {
        deliveryType: "delivery",
        deliveryLatitude: 19.081,
        deliveryLongitude: 72.882,
      },
    });
    const orderId = created.body.data.order.id;

    await request(app)
      .patch(`/api/v1/store/orders/${orderId}/accept`)
      .set("Cookie", ctx.storeCookie);

    await request(app)
      .patch(`/api/v1/store/orders/${orderId}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "ready" });

    const res = await request(app)
      .patch(`/api/v1/store/orders/${orderId}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "delivered" });

    expect(res.status).toBe(400);
  });
});

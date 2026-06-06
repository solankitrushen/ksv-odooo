import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { placeOrder } from "../helpers/orderHelpers.js";
import { registerUserPhone } from "../helpers/authHelpers.js";

describe("SPEC-010 — user-initiated cancel", () => {
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
    const item = await createMenuItem(app, ctx.adminCookie, { price: 250 });
    itemId = item.body.data.item.id;
  });

  it("cancels a pending paid order and raises a refund ticket", async () => {
    const order = await placeOrder(app, ctx.userCookie, { storeId, itemId });
    const orderId = order.body.data.order.id;

    const res = await request(app)
      .post(`/api/v1/user/orders/${orderId}/cancel`)
      .set("Cookie", ctx.userCookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("cancelled");
    // Paid (test provider) → refund ticket created, marked manual.
    expect(res.body.data.order.refund).toBeTruthy();
  });

  it("rejects cancelling an order the store already accepted", async () => {
    const order = await placeOrder(app, ctx.userCookie, { storeId, itemId });
    const orderId = order.body.data.order.id;

    await request(app)
      .patch(`/api/v1/store/orders/${orderId}/accept`)
      .set("Cookie", ctx.storeCookie)
      .send({});

    const res = await request(app)
      .post(`/api/v1/user/orders/${orderId}/cancel`)
      .set("Cookie", ctx.userCookie)
      .send({});

    expect(res.status).toBe(400);
  });

  it("IDOR: another user cannot cancel someone else's order", async () => {
    const order = await placeOrder(app, ctx.userCookie, { storeId, itemId });
    const orderId = order.body.data.order.id;

    const other = await registerUserPhone(app);
    const res = await request(app)
      .post(`/api/v1/user/orders/${orderId}/cancel`)
      .set("Cookie", other.cookie)
      .send({});

    expect(res.status).toBe(404);
  });

  it("double-cancel is rejected after the order is terminal", async () => {
    const order = await placeOrder(app, ctx.userCookie, { storeId, itemId });
    const orderId = order.body.data.order.id;

    await request(app)
      .post(`/api/v1/user/orders/${orderId}/cancel`)
      .set("Cookie", ctx.userCookie)
      .send({});
    const second = await request(app)
      .post(`/api/v1/user/orders/${orderId}/cancel`)
      .set("Cookie", ctx.userCookie)
      .send({});

    expect(second.status).toBe(400);
  });
});

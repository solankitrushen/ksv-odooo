import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";

describe("SPEC-003 Order cycle", () => {
  let app;
  let ctx;
  let storeId;
  let itemId;
  let orderId;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await ensureDefaultAdmin();
    ctx = await freshApiContext(app);
    storeId = ctx.storeReg.body.data.user.id || ctx.storeReg.body.data.user._id;
    const item = await createMenuItem(app, ctx.adminCookie, {
      name: "Order Item",
      price: 250,
    });
    itemId = item.body.data.item.id;
  });

  it("user creates order with server pricing", async () => {
    const res = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 2 }],
        userNote: "Less spicy",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.order.subtotal).toBe(500);
    expect(res.body.data.order.paymentStatus).toBe("success");
    orderId = res.body.data.order.id;
  });

  it("store lists pending orders", async () => {
    await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const res = await request(app)
      .get("/api/v1/store/orders?status=pending")
      .set("Cookie", ctx.storeCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBeGreaterThan(0);
  });

  it("user cannot accept order", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const id = created.body.data.order.id;
    const res = await request(app)
      .patch(`/api/v1/store/orders/${id}/accept`)
      .set("Cookie", ctx.userCookie);

    expect(res.status).toBe(403);
  });

  it("reject requires reason min 10 chars", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const id = created.body.data.order.id;
    const res = await request(app)
      .patch(`/api/v1/store/orders/${id}/reject`)
      .set("Cookie", ctx.storeCookie)
      .send({ reason: "no" });

    expect(res.status).toBe(400);
  });

  it("store accept → preparing → ready → delivered", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const id = created.body.data.order.id;

    const accept = await request(app)
      .patch(`/api/v1/store/orders/${id}/accept`)
      .set("Cookie", ctx.storeCookie);
    expect(accept.status).toBe(200);

    const prep = await request(app)
      .patch(`/api/v1/store/orders/${id}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "preparing" });
    expect(prep.status).toBe(200);

    const ready = await request(app)
      .patch(`/api/v1/store/orders/${id}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "ready" });
    expect(ready.status).toBe(200);

    const done = await request(app)
      .patch(`/api/v1/store/orders/${id}/status`)
      .set("Cookie", ctx.storeCookie)
      .send({ status: "delivered" });
    expect(done.status).toBe(200);
    expect(done.body.data.order.status).toBe("delivered");
  });

  it("store reject with reason notifies user via messages", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const id = created.body.data.order.id;

    await request(app)
      .patch(`/api/v1/store/orders/${id}/reject`)
      .set("Cookie", ctx.storeCookie)
      .send({ reason: "Kitchen closed for maintenance today" });

    const userView = await request(app)
      .get(`/api/v1/user/orders/${id}`)
      .set("Cookie", ctx.userCookie);

    expect(userView.body.data.order.status).toBe("rejected");
    expect(userView.body.data.order.rejectReason).toMatch(/maintenance/i);
    expect(userView.body.data.order.storeMessages.length).toBeGreaterThan(0);
  });

  it("store posts prep note visible to user", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const id = created.body.data.order.id;
    await request(app)
      .patch(`/api/v1/store/orders/${id}/accept`)
      .set("Cookie", ctx.storeCookie);

    await request(app)
      .post(`/api/v1/store/orders/${id}/message`)
      .set("Cookie", ctx.storeCookie)
      .send({
        type: "prep_note",
        message: "Extra napkins included",
      });

    const userView = await request(app)
      .get(`/api/v1/user/orders/${id}`)
      .set("Cookie", ctx.userCookie);

    expect(userView.body.data.order.prepNotes).toMatch(/napkins/i);
  });

  it("store report returns today stats", async () => {
    const res = await request(app)
      .get("/api/v1/store/orders/report")
      .set("Cookie", ctx.storeCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.report.totalOrders).toBeGreaterThanOrEqual(0);
    expect(res.body.data.report.byStatus).toBeDefined();
  });

  it("IDOR: other store cannot read order", async () => {
    const created = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "takeaway",
        items: [{ menuItemId: String(itemId), quantity: 1 }],
      });

    const id = created.body.data.order.id;

    const otherStore = await freshApiContext(app);
    const res = await request(app)
      .get(`/api/v1/store/orders/${id}`)
      .set("Cookie", otherStore.storeCookie);

    expect(res.status).toBe(404);
  });
});

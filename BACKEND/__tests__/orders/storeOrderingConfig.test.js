import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";

// SPEC-008 Phase 8.1 — per-store ordering config + quote math.
// Store defaults: minOrderValue 200, freeDeliveryThreshold 399, deliveryFee 40, radius 1km.
const NEAR = { deliveryLatitude: 19.081, deliveryLongitude: 72.882 };

describe("SPEC-008 store ordering config", () => {
  let app;
  let ctx;
  let storeId;
  let itemId; // price 250

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
    storeId = ctx.storeReg.body.data.user.id || ctx.storeReg.body.data.user._id;
    const item = await createMenuItem(app, ctx.adminCookie, {
      name: "Config Item",
      price: 250,
    });
    itemId = item.body.data.item.id;
  });

  const order = (qty, overrides = {}) =>
    request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "delivery",
        ...NEAR,
        items: [{ menuItemId: String(itemId), quantity: qty }],
        ...overrides,
      });

  it("free delivery at/above the store threshold", async () => {
    const res = await order(2); // subtotal 500 >= 399
    expect(res.status).toBe(201);
    expect(res.body.data.order.deliveryCharge).toBe(0);
  });

  it("charges the store delivery fee below the threshold (within radius)", async () => {
    const res = await order(1); // subtotal 250 < 399
    expect(res.status).toBe(201);
    expect(res.body.data.order.deliveryCharge).toBe(40);
  });

  it("blocks orders below the store minimum", async () => {
    const cheap = await createMenuItem(app, ctx.adminCookie, {
      name: "Cheap",
      price: 150,
    });
    const res = await request(app)
      .post("/api/v1/user/orders")
      .set("Cookie", ctx.userCookie)
      .send({
        storeId: String(storeId),
        deliveryType: "delivery",
        ...NEAR,
        items: [{ menuItemId: String(cheap.body.data.item.id), quantity: 1 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/minimum order/i);
  });

  it("store can update its ordering config and it takes effect", async () => {
    const patch = await request(app)
      .patch("/api/v1/store/profile/ordering")
      .set("Cookie", ctx.storeCookie)
      .send({ freeDeliveryThreshold: 1000, deliveryFee: 25 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.ordering.deliveryFee).toBe(25);

    const res = await order(2); // subtotal 500 < new threshold 1000 → fee 25
    expect(res.status).toBe(201);
    expect(res.body.data.order.deliveryCharge).toBe(25);
  });

  it("public stores expose the ordering config", async () => {
    const res = await request(app).get("/api/v1/public/stores");
    expect(res.status).toBe(200);
    const store = res.body.data.stores.find((s) => String(s.id) === String(storeId));
    expect(store.ordering).toMatchObject({
      minOrderValue: 200,
      freeDeliveryThreshold: 399,
      deliveryFee: 40,
    });
  });
});

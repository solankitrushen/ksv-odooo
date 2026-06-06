/**
 * Cross-spec smoke: SPEC-001b auth + SPEC-002 menu + SPEC-003 orders
 */
import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { placeOrder } from "../helpers/orderHelpers.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";

describe("E2E — Auth → Menu → Order", () => {
  let app;
  let ctx;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await ensureDefaultAdmin();
    ctx = await freshApiContext(app);
  });

  it("SPEC-001b: user session + /me", async () => {
    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", ctx.userCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe("user");
  });

  it("SPEC-002: menu item + discounted price visible", async () => {
    const item = await createMenuItem(app, ctx.adminCookie, {
      name: "Smoke Dosa",
      price: 100,
    });
    const itemId = item.body.data.item.id;

    await request(app)
      .post("/api/v1/admin/discounts")
      .set("Cookie", ctx.adminCookie)
      .send({
        name: "10pct",
        type: "percentage",
        value: 10,
        applicableTo: "items",
        itemIds: [String(itemId)],
        validFrom: new Date("2020-01-01").toISOString(),
        validUntil: new Date("2030-01-01").toISOString(),
      });

    const menu = await request(app)
      .get("/api/v1/user/menu")
      .set("Cookie", ctx.userCookie);
    const row = menu.body.data.menu.find(
      (m) => String(m.id) === String(itemId)
    );
    expect(row.appliedPrice).toBe(90);
  });

  it("SPEC-003: place → accept → message → user reads", async () => {
    const storeId =
      ctx.storeReg.body.data.user.id || ctx.storeReg.body.data.user._id;
    const item = await createMenuItem(app, ctx.adminCookie, { price: 250 });
    const itemId = item.body.data.item.id;

    const order = await placeOrder(app, ctx.userCookie, { storeId, itemId });
    const orderId = order.body.data.order.id;

    await request(app)
      .patch(`/api/v1/store/orders/${orderId}/accept`)
      .set("Cookie", ctx.storeCookie);

    await request(app)
      .post(`/api/v1/store/orders/${orderId}/message`)
      .set("Cookie", ctx.storeCookie)
      .send({ type: "feedback", message: "Ready at counter 2" });

    const view = await request(app)
      .get(`/api/v1/user/orders/${orderId}`)
      .set("Cookie", ctx.userCookie);

    expect(view.body.data.order.status).toBe("accepted");
    expect(view.body.data.order.storeMessages.length).toBeGreaterThan(0);
  });
});

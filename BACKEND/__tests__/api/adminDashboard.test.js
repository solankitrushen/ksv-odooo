import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";
import { placeOrder } from "../helpers/orderHelpers.js";
import Order from "../../src/Schema/Order.js";
import { ORDER_STATUS } from "../../config/constants.js";

describe("Admin dashboard & sales reports", () => {
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

  it("GET /admin/dashboard returns metrics", async () => {
    await placeOrder(app, ctx.userCookie, { storeId, itemId });

    const res = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Cookie", ctx.adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.dashboard.summary.totalOrders).toBeGreaterThanOrEqual(1);
    expect(res.body.data.dashboard.summary.platformFeeRate).toBe(0.01);
    expect(res.body.data.dashboard.statusBreakdown).toHaveProperty("pending");
    expect(res.body.data.dashboard.orderValueDistribution.length).toBeGreaterThan(0);
  });

  it("GET /admin/reports/sales returns time series", async () => {
    const created = await placeOrder(app, ctx.userCookie, { storeId, itemId });
    await Order.updateOne(
      { _id: created.body.data.order.id },
      { $set: { status: ORDER_STATUS.DELIVERED } }
    );

    const res = await request(app)
      .get("/api/v1/admin/reports/sales?groupBy=day")
      .set("Cookie", ctx.adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.report.totals.orderCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.report.series)).toBe(true);
  });

  it("403 user cannot access dashboard", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Cookie", ctx.userCookie);
    expect(res.status).toBe(403);
  });
});

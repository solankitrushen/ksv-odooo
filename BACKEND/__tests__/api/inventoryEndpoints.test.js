import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext, createMenuItem } from "../helpers/apiTestContext.js";

describe("API matrix — inventory /api/v1/admin & /user", () => {
  let app;
  let ctx;
  let itemId;
  let itemId2;
  let comboId;
  let discountId;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
    const i1 = await createMenuItem(app, ctx.adminCookie, { name: "Dosa", price: 100 });
    const i2 = await createMenuItem(app, ctx.adminCookie, {
      name: "Coffee",
      price: 40,
    });
    itemId = i1.body.data.item.id;
    itemId2 = i2.body.data.item.id;
  });

  describe("POST /admin/items", () => {
    it("201 admin creates item", async () => {
      const res = await createMenuItem(app, ctx.adminCookie, { name: "New" });
      expect(res.status).toBe(201);
    });

    it("403 user forbidden", async () => {
      const res = await createMenuItem(app, ctx.userCookie);
      expect(res.status).toBe(403);
    });

    it("401 no auth", async () => {
      const res = await request(app).post("/api/v1/admin/items").send({
        name: "Hack",
        price: 1,
        category: "X",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /admin/items/:id", () => {
    it("200 updates fields", async () => {
      const res = await request(app)
        .put(`/api/v1/admin/items/${itemId}`)
        .set("Cookie", ctx.adminCookie)
        .send({ price: 110 });
      expect(res.status).toBe(200);
      expect(res.body.data.item.price).toBe(110);
    });

    it("404 unknown id", async () => {
      const res = await request(app)
        .put("/api/v1/admin/items/507f1f77bcf86cd799439011")
        .set("Cookie", ctx.adminCookie)
        .send({ price: 50 });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /admin/items/:id/deactivate", () => {
    it("200 sets inactive", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/items/${itemId}/deactivate`)
        .set("Cookie", ctx.adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.item.isActive).toBe(false);
    });
  });

  describe("POST /admin/items/:id/image", () => {
    it("200 png upload", async () => {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      const res = await request(app)
        .post(`/api/v1/admin/items/${itemId2}/image`)
        .set("Cookie", ctx.adminCookie)
        .attach("image", png, { filename: "x.png", contentType: "image/png" });
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /admin/items/:id/image", () => {
    it("200 removes image path", async () => {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      await request(app)
        .post(`/api/v1/admin/items/${itemId2}/image`)
        .set("Cookie", ctx.adminCookie)
        .attach("image", png, { filename: "x.png", contentType: "image/png" });

      const res = await request(app)
        .delete(`/api/v1/admin/items/${itemId2}/image`)
        .set("Cookie", ctx.adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.item.imagePath).toBeNull();
    });
  });

  describe("POST /admin/combos", () => {
    it("201 valid combo", async () => {
      const res = await request(app)
        .post("/api/v1/admin/combos")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Combo",
          items: [
            { itemId: String(itemId), qty: 1 },
            { itemId: String(itemId2), qty: 1 },
          ],
          comboPrice: 120,
        });
      expect(res.status).toBe(201);
      comboId = res.body.data.combo._id;
    });

    it("400 single item combo", async () => {
      const res = await request(app)
        .post("/api/v1/admin/combos")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Bad",
          items: [{ itemId: String(itemId), qty: 1 }],
          comboPrice: 50,
        });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /admin/combos/:id", () => {
    it("200 update price", async () => {
      const created = await request(app)
        .post("/api/v1/admin/combos")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "C2",
          items: [
            { itemId: String(itemId), qty: 1 },
            { itemId: String(itemId2), qty: 1 },
          ],
          comboPrice: 130,
        });
      const id = created.body.data.combo._id;
      const res = await request(app)
        .put(`/api/v1/admin/combos/${id}`)
        .set("Cookie", ctx.adminCookie)
        .send({ comboPrice: 125 });
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /admin/combos/:id/deactivate", () => {
    it("200 deactivate", async () => {
      const created = await request(app)
        .post("/api/v1/admin/combos")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Off",
          items: [
            { itemId: String(itemId), qty: 1 },
            { itemId: String(itemId2), qty: 1 },
          ],
          comboPrice: 100,
        });
      const res = await request(app)
        .patch(`/api/v1/admin/combos/${created.body.data.combo._id}/deactivate`)
        .set("Cookie", ctx.adminCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /admin/discounts", () => {
    it("201 percentage on item", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Sale",
          type: "percentage",
          value: 15,
          applicableTo: "items",
          itemIds: [String(itemId2)],
          validFrom: new Date("2020-01-01").toISOString(),
          validUntil: new Date("2030-01-01").toISOString(),
        });
      expect(res.status).toBe(201);
      discountId = res.body.data.discount._id;
    });

    it("400 percent over 100", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Bad",
          type: "percentage",
          value: 150,
          applicableTo: "items",
          itemIds: [String(itemId2)],
          validFrom: new Date("2020-01-01").toISOString(),
          validUntil: new Date("2030-01-01").toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it("400 validFrom after validUntil", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Bad dates",
          type: "fixed",
          value: 10,
          applicableTo: "items",
          itemIds: [String(itemId2)],
          validFrom: new Date("2031-01-01").toISOString(),
          validUntil: new Date("2020-01-01").toISOString(),
        });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /admin/discounts/:id/deactivate", () => {
    it("200 soft-delete discount", async () => {
      const created = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Off",
          type: "fixed",
          value: 5,
          applicableTo: "items",
          itemIds: [String(itemId2)],
          validFrom: new Date("2020-01-01").toISOString(),
          validUntil: new Date("2030-01-01").toISOString(),
        });
      const res = await request(app)
        .patch(`/api/v1/admin/discounts/${created.body.data.discount._id}/deactivate`)
        .set("Cookie", ctx.adminCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /user/menu", () => {
    it("200 active items with pricing", async () => {
      await request(app)
        .post("/api/v1/admin/discounts")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Coffee off",
          type: "percentage",
          value: 10,
          applicableTo: "items",
          itemIds: [String(itemId2)],
          validFrom: new Date("2020-01-01").toISOString(),
          validUntil: new Date("2030-01-01").toISOString(),
        });

      const res = await request(app)
        .get("/api/v1/user/menu")
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.menu.length).toBeGreaterThan(0);
      const coffee = res.body.data.menu.find(
        (m) => String(m.id) === String(itemId2)
      );
      expect(coffee.appliedPrice).toBe(36);
    });

    it("401 without auth", async () => {
      const res = await request(app).get("/api/v1/user/menu");
      expect(res.status).toBe(401);
    });

    it("403 store cannot read user menu", async () => {
      const res = await request(app)
        .get("/api/v1/user/menu")
        .set("Cookie", ctx.storeCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /user/combos", () => {
    it("200 lists available combos", async () => {
      await request(app)
        .post("/api/v1/admin/combos")
        .set("Cookie", ctx.adminCookie)
        .send({
          name: "Lunch",
          items: [
            { itemId: String(itemId), qty: 1 },
            { itemId: String(itemId2), qty: 1 },
          ],
          comboPrice: 120,
        });

      const res = await request(app)
        .get("/api/v1/user/combos")
        .set("Cookie", ctx.userCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.combos.length).toBe(1);
    });
  });
});

import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { loginAdmin, registerUserPhone } from "../helpers/authHelpers.js";
import { ensureDefaultAdmin } from "../../src/Auth/seedAdmin.js";

const itemPayload = {
  name: "Masala Dosa",
  description: "Crispy rice crepe",
  price: 120,
  category: "Breakfast",
  tags: ["veg"],
};

describe("SPEC-002 Inventory", () => {
  let app;
  let adminCookie;
  let userCookie;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await ensureDefaultAdmin();
    adminCookie = (await loginAdmin(app)).cookie;
    userCookie = (await registerUserPhone(app)).cookie;
  });

  it("rejects non-admin on admin items", async () => {
    const res = await request(app)
      .post("/api/v1/admin/items")
      .set("Cookie", userCookie)
      .send(itemPayload);
    expect(res.status).toBe(403);
  });

  it("rejects price zero", async () => {
    const res = await request(app)
      .post("/api/v1/admin/items")
      .set("Cookie", adminCookie)
      .send({ ...itemPayload, name: "Free", price: 0 });
    expect(res.status).toBe(400);
  });

  it("admin flow: items, image, combo, discount, user menu", async () => {
    const item1 = await request(app)
      .post("/api/v1/admin/items")
      .set("Cookie", adminCookie)
      .send(itemPayload);
    expect(item1.status).toBe(201);
    const itemId = item1.body.data.item.id;

    const item2 = await request(app)
      .post("/api/v1/admin/items")
      .set("Cookie", adminCookie)
      .send({ ...itemPayload, name: "Filter Coffee", price: 50 });
    const itemId2 = item2.body.data.item.id;

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const upload = await request(app)
      .post(`/api/v1/admin/items/${itemId}/image`)
      .set("Cookie", adminCookie)
      .attach("image", png, { filename: "dosa.png", contentType: "image/png" });
    expect(upload.status).toBe(200);
    expect(upload.body.data.item.imagePath).toMatch(/\/public\/menu\//);

    const badMime = await request(app)
      .post(`/api/v1/admin/items/${itemId}/image`)
      .set("Cookie", adminCookie)
      .attach("image", Buffer.from("x"), {
        filename: "evil.exe",
        contentType: "application/octet-stream",
      });
    expect(badMime.status).toBe(400);

    const comboRes = await request(app)
      .post("/api/v1/admin/combos")
      .set("Cookie", adminCookie)
      .send({
        name: "Breakfast Combo",
        items: [
          { itemId: String(itemId), qty: 1 },
          { itemId: String(itemId2), qty: 1 },
        ],
        comboPrice: 150,
      });
    expect(comboRes.status).toBe(201);

    await request(app)
      .post("/api/v1/admin/discounts")
      .set("Cookie", adminCookie)
      .send({
        name: "Dosa deal",
        type: "percentage",
        value: 10,
        applicableTo: "items",
        itemIds: [String(itemId)],
        validFrom: new Date("2020-01-01").toISOString(),
        validUntil: new Date("2030-01-01").toISOString(),
      });

    const menu = await request(app)
      .get("/api/v1/user/menu")
      .set("Cookie", userCookie);
    expect(menu.status).toBe(200);
    const dosa = menu.body.data.menu.find((m) => String(m.id) === String(itemId));
    expect(dosa.appliedPrice).toBe(108);

    await request(app)
      .patch(`/api/v1/admin/items/${itemId2}/deactivate`)
      .set("Cookie", adminCookie);

    const combos = await request(app)
      .get("/api/v1/user/combos")
      .set("Cookie", userCookie);
    expect(combos.body.data.combos.length).toBe(0);

    const delImg = await request(app)
      .delete(`/api/v1/admin/items/${itemId}/image`)
      .set("Cookie", adminCookie);
    expect(delImg.body.data.item.imagePath).toBeNull();
  });
});

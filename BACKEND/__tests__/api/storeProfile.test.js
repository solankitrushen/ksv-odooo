import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext } from "../helpers/apiTestContext.js";

describe("Store profile /api/v1/store/profile", () => {
  let app;
  let ctx;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
  });

  it("returns the authenticated store profile", async () => {
    const res = await request(app)
      .get("/api/v1/store/profile")
      .set("Cookie", ctx.storeCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.store.email).toBe(ctx.storeEmail);
  });

  it("updates location with PATCH /location", async () => {
    const res = await request(app)
      .patch("/api/v1/store/profile/location")
      .set("Cookie", ctx.storeCookie)
      .send({ latitude: 28.6139, longitude: 77.209 });
    expect(res.status).toBe(200);
    expect(res.body.data.location.latitude).toBeCloseTo(28.6139);
  });

  it("rejects invalid lat/lng", async () => {
    const res = await request(app)
      .patch("/api/v1/store/profile/location")
      .set("Cookie", ctx.storeCookie)
      .send({ latitude: 95, longitude: 77.209 });
    expect(res.status).toBe(400);
  });

  it("admins can list and verify stores", async () => {
    const list = await request(app)
      .get("/api/v1/admin/stores")
      .set("Cookie", ctx.adminCookie);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data.stores)).toBe(true);
  });

  it("rejects non-admin from store admin routes", async () => {
    const res = await request(app)
      .get("/api/v1/admin/stores")
      .set("Cookie", ctx.userCookie);
    expect(res.status).toBe(403);
  });
});

import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import { freshApiContext } from "../helpers/apiTestContext.js";

describe("GET /api/v1/user/store", () => {
  let app;
  let ctx;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    ctx = await freshApiContext(app);
  });

  it("200 returns the cafe profile to a logged-in user", async () => {
    const res = await request(app)
      .get("/api/v1/user/store")
      .set("Cookie", ctx.userCookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.store).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      location: {
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      },
      deliveryRadiusKm: expect.any(Number),
    });
    // Must not leak credentials.
    expect(res.body.data.store).not.toHaveProperty("password");
    expect(res.body.data.store).not.toHaveProperty("email");
    expect(res.body.data.store).not.toHaveProperty("bankDetails");
  });

  it("401 when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/user/store");
    expect(res.status).toBe(401);
  });

  it("403 when called with store credentials (user role only)", async () => {
    const res = await request(app)
      .get("/api/v1/user/store")
      .set("Cookie", ctx.storeCookie);
    expect(res.status).toBe(403);
  });
});

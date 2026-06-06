import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

describe("Admin auth /api/v1/auth/admin", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("logs in seeded admin", async () => {
    const res = await request(app).post("/api/v1/auth/admin/login").send({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("admin");
  });

  it("rejects wrong admin password", async () => {
    const res = await request(app).post("/api/v1/auth/admin/login").send({
      email: process.env.ADMIN_EMAIL,
      password: "WrongPass@999",
    });

    expect(res.status).toBe(401);
  });
});

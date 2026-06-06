import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

const password = "TestPass@123";

describe("authMiddleware via GET /api/v1/auth/me", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns profile with valid cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/user/register").send({
      name: "Me User",
      phone: "9988776655",
      password,
      confirmPassword: password,
    });

    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("user");
    expect(res.body.data.user.phone).toBe("9988776655");
  });
});

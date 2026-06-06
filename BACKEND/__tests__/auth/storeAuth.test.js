import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import Store from "../../src/Schema/Store.js";

const password = "StorePass@123";
const validLocation = { latitude: 23.0225, longitude: 72.5714 };

describe("Store auth /api/v1/auth/store", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("registers store with valid data", async () => {
    const res = await request(app)
      .post("/api/v1/auth/store/register")
      .send({
        name: "Cafe One",
        phone: "9123456780",
        email: "cafe1@example.com",
        password,
        confirmPassword: password,
        address: { street: "12 Road", city: "Ahmedabad", zipCode: "380001" },
        location: validLocation,
        upiId: "cafe@upi",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("store");
  });

  it("rejects store register without location", async () => {
    const res = await request(app)
      .post("/api/v1/auth/store/register")
      .send({
        name: "No-Loc",
        phone: "9123456790",
        email: "noloc@example.com",
        password,
        confirmPassword: password,
        address: { street: "12 Road", city: "Ahmedabad", zipCode: "380001" },
      });
    expect(res.status).toBe(400);
  });

  it("blocks login until admin verifies, then allows it", async () => {
    await request(app)
      .post("/api/v1/auth/store/register")
      .send({
        name: "Cafe Two",
        phone: "9123456781",
        email: "cafe2@example.com",
        password,
        confirmPassword: password,
        address: { street: "12 Road", city: "Ahmedabad", zipCode: "380001" },
        location: validLocation,
      });

    const blocked = await request(app)
      .post("/api/v1/auth/store/login")
      .send({ email: "cafe2@example.com", password });
    expect(blocked.status).toBe(403);

    await Store.updateOne(
      { email: "cafe2@example.com" },
      { $set: { isVerified: true } }
    );

    const ok = await request(app)
      .post("/api/v1/auth/store/login")
      .send({ email: "cafe2@example.com", password });

    expect(ok.status).toBe(200);
    expect(ok.body.data.tokens.accessToken).toBeDefined();
  });
});

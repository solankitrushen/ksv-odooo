import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";
import {
  isDisposableEmail,
  getEmailDomain,
} from "../../src/Utils/disposableEmail.js";

const password = "TestPass@123";

describe("Disposable email blocklist", () => {
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("detects known disposable domains", () => {
    expect(isDisposableEmail("user@mailinator.com")).toBe(true);
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
    expect(getEmailDomain("A@Mailinator.COM")).toBe("mailinator.com");
  });

  it("rejects user register with disposable email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Temp User",
        email: "temp@mailinator.com",
        password,
        confirmPassword: password,
      });

    expect(res.status).toBe(400);
    const msg =
      res.body.message ||
      res.body.details?.map((d) => d.message).join(" ");
    expect(msg).toMatch(/Disposable|temporary/i);
  });

  it("rejects login-otp for disposable email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/login-otp")
      .send({ email: "otp@yopmail.com" });

    expect(res.status).toBe(400);
  });

  it("allows register with legitimate email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/user/register")
      .send({
        name: "Real User",
        email: `real${Date.now()}@gmail.com`,
        password,
        confirmPassword: password,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.pendingVerification).toBe(true);
  });
});

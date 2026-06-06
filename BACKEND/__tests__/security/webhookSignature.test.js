import { describe, it, expect, beforeAll } from "@jest/globals";
import crypto from "crypto";
import express from "express";
import request from "supertest";
import { connectDB } from "../../src/db.js";
import webhookRouter from "../../src/Routes/webhook.js";

const WEBHOOK_SECRET = "test_webhook_secret_abcdef123456";

function sign(body) {
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
}

function makeApp() {
  const app = express();
  // Webhook router applies express.raw internally.
  app.use("/api/v1/webhook", webhookRouter);
  return app;
}

describe("Razorpay webhook signature", () => {
  let app;
  beforeAll(async () => {
    await connectDB();
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    app = makeApp();
  });

  it("rejects requests with no signature header", async () => {
    const body = JSON.stringify({ id: "evt_1", event: "payment.captured" });
    const res = await request(app)
      .post("/api/v1/webhook/razorpay")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(400);
  });

  it("rejects requests with a wrong signature", async () => {
    const body = JSON.stringify({ id: "evt_2", event: "payment.captured" });
    const res = await request(app)
      .post("/api/v1/webhook/razorpay")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", "deadbeef")
      .send(body);
    expect(res.status).toBe(401);
  });

  it("accepts a correctly signed event and is idempotent", async () => {
    const body = JSON.stringify({
      id: "evt_3",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_xyz",
            order_id: "order_xyz",
          },
        },
      },
    });
    const sig = sign(body);
    const ok = await request(app)
      .post("/api/v1/webhook/razorpay")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", sig)
      .send(body);
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);

    // Replay — same event id MUST short-circuit as duplicate.
    const dup = await request(app)
      .post("/api/v1/webhook/razorpay")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", sig)
      .send(body);
    expect(dup.status).toBe(200);
    expect(dup.body.duplicate).toBe(true);
  });
});
